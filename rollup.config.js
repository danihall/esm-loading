//@TODO: split babel-polyfills into separate chunks ( seems very complex so it can wait ).
import * as $ from "./rollup.constants.js";// Chemins absolut et helpers.
import { rollup } from "rollup";
import { terser } from "rollup-plugin-terser";
import virtual from "@rollup/plugin-virtual";
import alias from "@rollup/plugin-alias";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import babel from "@rollup/plugin-babel";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

/**
 * @see https://github.com/rollup/plugins/tree/master/packages/babel
 * @see https://babeljs.io/docs/en/babel-preset-env
 */
const configBabel = ( { legacy = false } = {} ) => ( {
    exclude: [ /node_modules/ ],
    babelHelpers: "bundled",
    presets: [ [ "@babel/preset-env", {
        exclude: legacy ? [] : [ "es.array.includes", "es.string.includes" ],
        targets: { browsers: legacy ?
            [ "ie 11" ] :
            [ "last 4 Chrome versions", "last 4 Safari versions", "last 4 iOS versions", "last 4 Edge versions", "Firefox ESR" ]// À voir si c'est pas quand même préférable pour les browsers modernes de targeter "{esmodules: true}" (même si ça génère plus de polyfills).
        },
        useBuiltIns: "usage",
        modules: legacy ? "auto" : false,
        corejs: 3
    } ] ],
    plugins: [ [ "transform-remove-console", {
        exclude: [ "error" ]
    } ] ]
} );

/**
 * Supprime des fichiers inutiles générés par le plugin "rollup-virtual".
 * @see https://rollupjs.org/guide/en/#generatebundle
 */
const beforeFilesWrite = () => ( {
    generateBundle( _outputOptions, bundle ) {
        Object.keys( bundle ).forEach( module => module.includes( "virtual-entry" ) && delete bundle[ module ] );
    }
} );

/**
 * Une fois que Rollup à écrit sur le disque les fichiers de sortie,
 * on utilise les infos sur le bundle pour créer un JSON mappant les dépendances composant -> helper.
 * @see https://rollupjs.org/guide/en/#writebundle
 */
const afterFilesWrite = () => ( {
    writeBundle( _outputOptions, bundle ) {
        const t1 = performance.now();
        const oldFiles = fs.readdirSync( $.DIST_PATH );
        const newFiles = Object.keys( bundle );

        Promise.all( [
            ...oldFiles.map( removeDeprecatedFiles, { newFiles } ),
            ...newFiles.map( createDependencyGraph, { bundle } )
        ] )
        .then( () => fs.promises.writeFile( `${$.DIST_PATH}/graph.json`, JSON.stringify( $.sortGraphByPriority( $.MODULES_GRAPH ) ) ) )
        .then( () => console.log( `\x1b[42mcreated graph.json in ${Math.round( performance.now() - t1 )}ms\x1b[0m` ) )
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
 * Relance le processus d'analyse sur chaque fichier de sortie d'un composant (ex: sidebar-431c499f.js),
 * afin d'obtenir une liste de toutes les dépendances utilisé par ce composant (y-compris des sous-dépendances insoupçonnées).
 * @see https://rollupjs.org/guide/en/#javascript-api
 * @this {Object} bundle
 */
const createDependencyGraph = async function( outputFile ) {
    const [ sourceFile ] = Object.keys( this.bundle[ outputFile ].modules );
    if ( !( sourceFile in $.MODULES ) ) {
        return;
    }

    const individualEntry = await rollup( { input: path.resolve( $.DIST_PATH, outputFile ) } );
    const individualBundle = await individualEntry.generate( { preserveModules: true } );

    const [ module, ...helpers ] = individualBundle.output;
    const individualGraph = {
        selectorInit: module.code.match( $.SELECTOR_INIT_REGEX )?.[ 1 ] || false,
        moduleFile: module.fileName,
        helperFiles: helpers.map( helper => helper.fileName ),
        priority: $.MODULES[ sourceFile ].priority ?? "low",
        loadingPoint: $.MODULES[ sourceFile ].loadingPoint ?? "static"
    };

    individualEntry.close();

    if ( !individualGraph.selectorInit && individualGraph.loadingPoint !== "static" ) {
        return Promise.reject( `\x1b[1m\x1b[43m >\x1b[1m\x1b[41m \x1b[4m"${individualGraph.moduleFile}"\x1b[0m\x1b[1m\x1b[41m is dynamically loaded {loadingPoint: ${individualGraph.loadingPoint}}.\n\x1b[1m\x1b[43m     >\x1b[1m\x1b[41m No "selectorInit" was found in code to link the module to an HTML Element! \n\n` );
    }

    $.MODULES_GRAPH.push( individualGraph );
};

/**
 * Config no-modules pour générer un bundle pour les navigateurs legacy (= IE 11).
 */
const noModuleConfig = {
    input: "virtual-legacy-entry",
    output: {
        dir: $.DIST_PATH,
        entryFileNames: "bundle-nomodule-[hash].js",
        format: "iife"
    },
    watch: false, // Pas besoin de générer ce bundle en mode dev (@see package.json -> "scripts" -> "dev").
    plugins: [
        virtual( { "virtual-legacy-entry": $.VIRTUAL_LEGACY_ENTRY } ),
        alias( { entries: [ { find: "coreComponents", replacement: $.CORE_COMPONENTS_PATH } ] } ),
        nodeResolve( { moduleDirectories: [ "node_modules", "assets/js" ] } ),
        commonjs(),
        json(),
        babel( configBabel( { legacy: true } ) ),
        terser()
    ]
};

/**
 * Config appliquée pour les browser supportant les ES Modules.
 * @see https://rollupjs.org/guide/en/#big-list-of-options
 */
const moduleConfig = {
    input: "virtual-entry",
    output: {
        dir: $.DIST_PATH,
        hoistTransitiveImports: false, // Empêche de hoister des dépendances de dépendances sur le fichier d'entrée lorsque Rollup transforme les fichiers.
        manualChunks: $.splitChunks
    },
    watch: {
        clearScreen: false,
        include: `${$.JS_PATH}/**`
    },
    plugins: [
        virtual( { "virtual-entry": $.VIRTUAL_ENTRY } ),
        alias( { entries: [ { find: "coreComponents", replacement: $.CORE_COMPONENTS_PATH } ] } ),
        nodeResolve( { moduleDirectories: [ "node_modules", "assets/js" ] } ),
        commonjs(), //transforme des export commonJS (: "export(..)") en export ES6
        json(), //permet de faire des import de JSON dans des modules.
        $.MODE_PROD && babel( configBabel() ), // transpilation
        beforeFilesWrite(), // hook dans lequel on supprime des fichiers inutiles générés par le plugin "@rollup/plugin-virtual".
        afterFilesWrite(), // hook dans lequel on crée un JSON représentant les dépendances des composants.
        $.MODE_PROD && terser() // uglifie + minifie output final.
    ]
};

export default [ moduleConfig, noModuleConfig ];
