import fs from "node:fs";
import path from "node:path";
import process from "node:process";
const { devDependencies } = JSON.parse( fs.readFileSync( "./package.json" ) );
const { modules, domPolyfills } = JSON.parse( fs.readFileSync( "./assets/js/index.json" ) );

const MODE_PROD = process.env.NODE_ENV === "prod";

const JS_PATH = path.resolve( "assets/js" );
const DIST_PATH = path.resolve( MODE_PROD ? "dist/prod/js" : "dist/dev/js" );

const replacer = ( match ) => `${JS_PATH}/${match}`;
const getModuleAbsolutePath = ( [ file, options ] ) => [ file.replace( /.*/, replacer ), options ];
const writeImport = ( file ) => `import "${file}";`;

const MODULES = Object.fromEntries( Object.entries( modules ).map( getModuleAbsolutePath ) );
const VIRTUAL_ENTRY = Object.keys( MODULES ).map( writeImport ).join( "" );
const VIRTUAL_LEGACY_ENTRY = domPolyfills.map( writeImport ).join( "" ) + VIRTUAL_ENTRY.replace( /import[^;]*esm-dynamic-loader[^;]*;/, "" );

const SELECTOR_INIT_REGEX = /(?:selectorInit)(?:"|\s|=)*([^"]*)/;

const MODULES_GRAPH = [];

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
        return id;// isolate this chunk to avoid circular dependencies.
    }
    if ( id.includes( JS_PATH ) ) {
        return getFileName( id );// your homemade JS chunks
    }
    if ( id.includes( "node_modules" ) && !id.includes( "core-js" ) ) {
        return `vendors-${getFileName( id )}`;// chunks of third-party libs
    }
    return "babel-polyfills";// chunks of poyfills added by Babel
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
        loadingPoint: /static|onClick|onFocusIn|onIntersection|onInjection/
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
    DIST_PATH,
    MODULES,
    VIRTUAL_ENTRY,
    VIRTUAL_LEGACY_ENTRY,
    SELECTOR_INIT_REGEX,
    MODULES_GRAPH,
    sortGraphByPriority,
    splitChunks
};
