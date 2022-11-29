import * as $ from "./rollup.utils.js";
import { rollup } from "rollup";
import { terser } from "rollup-plugin-terser";
import { minify } from "terser";
import virtual from "@rollup/plugin-virtual";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import babel from "@rollup/plugin-babel";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

const configBabel = ( { legacy = false } = {} ) => ( {
    exclude: [ /node_modules/ ],
    babelHelpers: "bundled",
    presets: [ [ "@babel/preset-env", {
        exclude: legacy ? [] : [ "es.array.includes", "es.string.includes" ],
        targets: { browsers: legacy ?
            [ "ie 11" ] :
            [ "last 4 Chrome versions", "last 4 Safari versions", "last 4 iOS versions", "last 4 Edge versions", "Firefox ESR" ]
        },
        useBuiltIns: "usage",
        modules: legacy ? "auto" : false,
        corejs: 3
    } ] ],
    plugins: [ [ "transform-remove-console", {
        exclude: [ "error" ]
    } ] ]
} );

const beforeFilesWrite = () => ( {
    generateBundle( _outputOptions, bundle ) {
        Object.keys( bundle ).forEach( module => module.includes( "virtual-entry" ) && delete bundle[ module ] );
    }
} );

const afterFilesWrite = () => ( {
    writeBundle( _outputOptions, bundle ) {
        const oldFiles = fs.readdirSync( $.DIST_PATH );
        const newFiles = Object.keys( bundle );

        Promise.all( [
            ...oldFiles.map( removeDeprecatedFiles, { newFiles } ),
            ...newFiles.map( createDependencyGraph, { bundle } )
        ] )
        .then( () => fs.promises.writeFile( `${$.DIST_PATH}/graph.json`, JSON.stringify( $.sortGraphByPriority( $.MODULES_GRAPH ) ) ) )
        .then( () => $.MODE_PROD && Promise.all( newFiles.map( minifyEsModule, { bundle } ) ) )
        .catch( ( reason ) => void( console.log( `\x1b[1m\x1b[41m\n\n\n ERROR ! CANNOT CREATE DEPENDENCIES GRAPH:\n\n\n${reason} \x1b[0m` ), process.exit( 1 ) ) )
        .finally( () => $.MODULES_GRAPH.length = 0 );
    }
} );

/**
 * @param {String} oldFile
 * @this {Array} newFiles
 */
const removeDeprecatedFiles = function( oldFile ) {
    return !this.newFiles.includes( oldFile ) && !oldFile.includes( "graph.json" ) && fs.promises.unlink( `${$.DIST_PATH}/${oldFile}` );
};

/**
 * @param {String} outputFile
 * @this {Object} bundle
 */
const createDependencyGraph = async function( outputFile ) {
    const [ sourceFile ] = Object.keys( this.bundle[ outputFile ].modules );

    if ( !( sourceFile in $.MODULES ) ) {
        return;
    }

    const outputFilePath = path.resolve( $.DIST_PATH, outputFile );
    const individualEntry = await rollup( { input: outputFilePath } );
    const individualBundle = await individualEntry.generate( { preserveModules: true } );

    const [ module, ...helpers ] = individualBundle.output;
    const individualGraph = {
        selector: module.code.match( $.SELECTOR_REGEX )?.[ 1 ] || false,
        moduleFile: module.fileName,
        dependencies: helpers.map( helper => helper.fileName ),
        priority: $.MODULES[ sourceFile ].priority ?? "low",
        loadingPoint: $.MODULES[ sourceFile ].loadingPoint ?? "static"
    };

    individualEntry.close();

    if ( !individualGraph.selector && individualGraph.loadingPoint !== "static" ) {
        return Promise.reject( `\x1b[1m\x1b[43m >\x1b[1m\x1b[41m \x1b[4m"${individualGraph.moduleFile}"\x1b[0m\x1b[1m\x1b[41m is dynamically loaded {loadingPoint: ${individualGraph.loadingPoint}}.\n\x1b[1m\x1b[43m     >\x1b[1m\x1b[41m No "selector" was found in code to link the module to an HTML Element! \n\n` );
    }

    $.MODULES_GRAPH.push( individualGraph );
};

/**
 * @param {String} file
 * @this {Object} bundle
 */
const minifyEsModule = async function( file ) {
    const fileCode = this.bundle[ file ].code;
    const outputFilePath = path.resolve( $.DIST_PATH, file );

    const minified = await minify( fileCode, { module: true } );
    await fs.promises.writeFile( outputFilePath, minified.code );
};

/**
 * config for legacy browsers
 */
const noModuleConfig = {
    input: "virtual-legacy-entry",
    output: {
        dir: $.DIST_PATH,
        entryFileNames: "bundle-nomodule-[hash].js",
        format: "iife"
    },
    watch: false,
    plugins: [
        virtual( { "virtual-legacy-entry": $.VIRTUAL_LEGACY_ENTRY } ),
        nodeResolve( { modulePaths: [ "node_modules", "assets/js" ] } ),
        commonjs(),
        json(),
        babel( configBabel( { legacy: true } ) ),
        terser()
    ]
};

/**
 * config for browser that support es-modules
 */
const moduleConfig = {
    input: "virtual-entry",
    output: {
        dir: $.DIST_PATH,
        hoistTransitiveImports: false,
        manualChunks: $.splitChunks
    },
    watch: {
        clearScreen: false,
        include: `${$.JS_PATH}/**`
    },
    plugins: [
        virtual( { "virtual-entry": $.VIRTUAL_ENTRY } ),
        nodeResolve( { modulePaths: [ "node_modules", "assets.js" ] } ),
        commonjs(),
        json(),
        $.MODE_PROD && babel( configBabel() ),
        beforeFilesWrite(),
        afterFilesWrite()

        //$.MODE_PROD && terser() // uglifie + minifie output final.
    ]
};

export default [ moduleConfig, noModuleConfig ];
