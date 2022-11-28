import { s as subscribe, u as unSubscribe } from './pubsub-267f5d93.js';
import { u as unBracket } from './unbracket-8b69dca6.js';

const loadingMap = JSON.parse( document.getElementById( "esm-loading-map" ).textContent );
let onClickSelectors = loadingMap.onClick && Object.keys( loadingMap.onClick );
let onFocusInSelectors = loadingMap.onFocusIn && Object.keys( loadingMap.onFocusIn );
let onIntersectSelectors = loadingMap.onIntersection && Object.keys( loadingMap.onIntersection );
let onInjectionSelectors = loadingMap.onInjection && Object.keys( loadingMap.onInjection );
let onCompleteSelectors = loadingMap.onComplete && Object.keys( loadingMap.onComplete );

if ( onClickSelectors ) {
    document.body.addEventListener( "click", _onClick );
}
if ( onFocusInSelectors ) {
    window.addEventListener( "focusin", _onFocusIn );
}

if ( onIntersectSelectors ) {
    const intersectionObserver = new IntersectionObserver( _onIntersection );
    onIntersectSelectors.forEach( selector => intersectionObserver.observe( document.body.querySelector( selector ) ) );
}
if ( onInjectionSelectors ) {
    subscribe( "html-injected", _onInjection );
}
if ( onCompleteSelectors ) {
    if ( document.readyState !== "complete" ) {
        window.addEventListener( "load", _onComplete );
    } else {
        _onComplete();
    }
}

/**
 * @param {Event} event
 */
function _onClick( event ) {
    const effectiveTarget = event.target.closest( onClickSelectors.join( "," ) );

    if ( effectiveTarget ) {
        event.stopImmediatePropagation();
        if ( effectiveTarget.tagName === "A" ) {
            event.preventDefault();
        }
        const keysToLoad = onClickSelectors.filter( hasClosestNode, effectiveTarget );
        onClickSelectors = onClickSelectors.filter( getUnusedSelector, keysToLoad );

        if ( !onClickSelectors.length ) {
            onClickSelectors = null;
            this.removeEventListener( "click", _onClick );
        }

        Promise.all( keysToLoad.map( loadModule, loadingMap.onClick ) )
        .then( () => event.target.dispatchEvent( new Event( event.type, event ) ) );
    }
}
/**
 * @param {Event} event
 */
function _onFocusIn( event ) {
    const effectiveTarget = event.target.closest( onFocusInSelectors.join( "," ) );

    if ( effectiveTarget ) {
        const keysToLoad = onFocusInSelectors.filter( hasClosestNode, effectiveTarget );
        onFocusInSelectors = onFocusInSelectors.filter( getUnusedSelector, keysToLoad );

        if ( !onFocusInSelectors.length ) {
            onFocusInSelectors = null;
            this.removeEventListener( "focusin", _onFocusIn );
        }

        Promise.all( keysToLoad.map( loadModule, loadingMap.onFocusIn ) );
    }
}

/**
 * @param {Array <IntersectionObserverEntry>} entries
 */
function _onIntersection( entries ) {
    const keysToLoad = [];

    entries.forEach( entry => {
        if ( entry.isIntersecting ) {
            const effectiveSelector = onIntersectSelectors.find( hasClosestNode, entry.target );

            if ( effectiveSelector ) {
                this.unobserve( entry.target );
                keysToLoad.push( effectiveSelector );
            }
        }
    } );

    if ( keysToLoad.length ) {
        onIntersectSelectors = onIntersectSelectors.filter( getUnusedSelector, keysToLoad );

        if ( !onIntersectSelectors.length ) {
            onIntersectSelectors = null;
            this.disconnect();
        }

        Promise.all( keysToLoad.map( loadModule, loadingMap.onIntersection ) );
    }
}

/**
 * @param {Object} data
 */
function _onInjection( data ) {
    const keysToLoad = onInjectionSelectors.filter( containsSelector, data.html );

    if ( keysToLoad.length ) {
        onInjectionSelectors = onInjectionSelectors.filter( getUnusedSelector, keysToLoad );

        if ( !onInjectionSelectors.length ) {
            onInjectionSelectors = null;
            unSubscribe( "html-injected", _onInjection );
        }

        Promise.all( keysToLoad.map( loadModule, loadingMap.onInjection ) );
    }
}
function _onComplete() {
    this.removeEventListener( "load", _onComplete );
    Promise.all( Object.keys( loadingMap.onComplete ).map( loadModule, loadingMap.onComplete ) );
}

/**
 * @param {String} selector
 * @this {Array} keysToLoad
 * @returns {Boolean}
 */
function getUnusedSelector( selector ) {
    return !this.includes( selector );
}

/**
 * @param {String} selector
 * @this {HTMLElement}
 * @returns {Boolean}
 */
function hasClosestNode( selector ) {
    return this.matches( selector ) || !!this.closest( selector );
}

/**
 * @param {String} selector
 * @this {String} html
 * @returns {Boolean}
 */
function containsSelector( selector ) {
    return this.includes( unBracket( selector ) );
}

/**
 * @param {*} keyToLoad
 * @this {Object} loadingMap
 * @returns {Promise}
 */
function loadModule( keyToLoad ) {
    return import( this[ keyToLoad ] );
}
