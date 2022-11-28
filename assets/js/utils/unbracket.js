const regex = /\[|\]/g;

/**
 * @param {String} string
 */
export const unBracket = ( string ) => string.replace( regex, "" );
