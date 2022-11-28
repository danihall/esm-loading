const regex = /\[|\]/g;

/**
 * @param {String} string
 */
const unBracket = ( string ) => string.replace( regex, "" );

export { unBracket as u };
