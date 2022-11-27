import { modules, domPolyfills } from "./assets/js/index.json";
import { devDependencies } from "./package.json";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const MODE_PROD = process.env.NODE_ENV === "prod";

const JS_PATH = path.resolve( "assets/js" );
const CORE_COMPONENTS_PATH = path.resolve( "vendor/newebfront/core-components/assets/js" );
const DIST_PATH = path.resolve( MODE_PROD ? "Resources/public/build/js" : "public/assets/build/js" );

const replacer = ( match ) => match === "coreComponents" ? CORE_COMPONENTS_PATH : `${JS_PATH}/${match}`;
const getModuleAbsolutePath = ( [ file, options ] ) => [ file.replace( /coreComponents|.+/, replacer ), options ];
const writeImport = ( file ) => `import "${file}";`;

const MODULES = Object.fromEntries( Object.entries( modules ).map( getModuleAbsolutePath ) );//clone de modules.json mais avec des chemins absolus.
const VIRTUAL_ENTRY = Object.keys( MODULES ).map( writeImport ).join( "" );// tableau d'imports à faire analyser par Rollup.
const VIRTUAL_LEGACY_ENTRY = domPolyfills.map( writeImport ).join( "" ) + VIRTUAL_ENTRY.replace( /import[^;]*esm-dynamic-loader[^;]*;/, "" );// supprime l'entrée esm-loader

const SELECTOR_INIT_REGEX = /(?:selectorInit:)(?:\s*)(?:"|')((.(?!,|\n|}))*)/;

const MODULES_GRAPH = [];// Contiendra les arbres de dépendances "composant -> helpers" pour chaque module.

const getModuleByPriority = function( module ) {
    return module.priority === this;
};
const sortGraphByPriority = ( graph ) => [
    ...graph.filter( getModuleByPriority, "very-high" ),
    ...graph.filter( getModuleByPriority, "high" ),
    ...graph.filter( getModuleByPriority, "low" )
];

const getFileName = ( path ) => path.split( ".js" )[ 0 ].split( "/" ).pop();
const splitChunks = ( id ) => {
    if ( id.includes( "virtual-entry" ) ) {
        return id;// Nécessaire de découper ces chunks à part pour éviter des dépendances circulaires.
    }
    if ( id.includes( JS_PATH ) || id.includes( CORE_COMPONENTS_PATH ) ) {
        return getFileName( id );// chunks des JS maison.
    }
    if ( id.includes( "node_modules" ) && !id.includes( "core-js" ) ) {
        return `vendors-${getFileName( id )}`;// chunks de librairies tierces qui ne sont pas des polyfills de Babel.
    }
    return "babel-polyfills";// chunks des polyfills ajoutés par Babel.
};

{
    const caret = "\x1b[1m\x1b[43m >";
    const subCaret = "\x1b[1m\x1b[43m     >";
    const bgRed = "\x1b[1m\x1b[41m";
    const underline = "\x1b[4m";
    const reset = "\x1b[0m";
    const regexs = {
        fileExtension: /.js|.mjs/,
        optionName: /priority|loadingPoint/,
        priority: /low|high|very-high/,
        loadingPoint: /static|onClick|onIntersection|onInjection|onComplete/
    };
    const getInvalidOptions = ( options ) => Object.entries( options )
        .map( ( [ name, value ] ) => [
            !regexs.optionName.test( name ) && `"${name} is not a valid option name`,
            regexs.optionName.test( name ) && !regexs[ name ].test( value ) && `"${value}" is not a valid ${name}`
        ] )
        .flat()
        .filter( Boolean )
        .join( ", " );

    let invalidIndex = Object.keys( modules )
        .filter( key => !regexs.fileExtension.test( key ) )
        .map( invalidKey => `${caret}${bgRed} ${underline}${invalidKey}${reset}${bgRed}: missing ".js|.mjs" file extension. \n\n` )
        .join( "" );
    invalidIndex += Object.keys( MODULES )
        .filter( path => !fs.existsSync( path ) )
        .map(  unResolvedPath => `${caret}${bgRed} ${underline}${unResolvedPath}${reset}${bgRed}:\n${subCaret}${bgRed}file not found. \n\n` )
        .join( "" );
    invalidIndex += domPolyfills
        .filter( polyfill => !( polyfill in devDependencies ) )
        .map( missingPolyfill => `${caret}${bgRed} ${underline}${missingPolyfill}${reset}${bgRed}: not found in devDependencies. \n\n` )
        .join( "" );
    invalidIndex += Object.entries( modules )
        .filter( ( [ , options ] ) => Object.keys( options ).length > 0 )
        .map( ( [ key, options ] ) => ( { key, invalidOptions: getInvalidOptions( options ) } ) )
        .filter( entry => entry.invalidOptions )
        .map( ( { key, invalidOptions } ) => `${caret}${bgRed} ${underline}${key}${reset}${bgRed}: invalid options. \n${subCaret}${bgRed} ${invalidOptions} \n\n` )
        .join( "" );

    if ( invalidIndex ) {
        console.log( `${bgRed}\n\n\n ERROR ! "./assets/js/index.json" IS NOT VALID:\n\n\n${invalidIndex} ${reset}` );
        process.exit( 1 );
    }
}

export {
    MODE_PROD,
    JS_PATH,
    CORE_COMPONENTS_PATH,
    DIST_PATH,
    MODULES,
    VIRTUAL_ENTRY,
    VIRTUAL_LEGACY_ENTRY,
    SELECTOR_INIT_REGEX,
    MODULES_GRAPH,
    sortGraphByPriority,
    splitChunks
};
