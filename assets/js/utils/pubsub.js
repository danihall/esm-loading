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
};

/**
 * Unsubscribe to a specific event
 * @param {String} type
 * @param {Function} callback
 */
function unSubscribe( type, callback ) {
    if ( subscribers[ type ] ) {
        subscribers[ type ] = subscribers[ type ].filter( ( cb ) => cb !== callback );
    }
};

/**
 * Notify subscribers for occurence of given event
 * @param {String} type
 * @param {any} data
 */
function notify( type, data ) {
    if ( subscribers[ type ] ) {
        subscribers[ type ].forEach( ( callback ) => callback( data ) );
    }
};

export {
    subscribe,
    unSubscribe,
    notify
};
