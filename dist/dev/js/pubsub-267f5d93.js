const subscribers = {};

/**
 * Subscribe to a specific event
 * @param {String} type
 * @param {Function} callback
 */
function subscribe( type, callback ) {
    if ( !subscribers[ type ] ) {
        subscribers[ type ] = [];
    }

    subscribers[ type ].push( callback );
}
/**
 * Unsubscribe to a specific event
 * @param {String} type
 * @param {Function} callback
 */
function unSubscribe( type, callback ) {
    if ( subscribers[ type ] ) {
        subscribers[ type ] = subscribers[ type ].filter( ( cb ) => cb !== callback );
    }
}

export { subscribe as s, unSubscribe as u };
