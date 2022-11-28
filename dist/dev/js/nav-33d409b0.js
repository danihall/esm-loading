const init = {
    selectorInit: "#nav"
};
const nav = document.querySelector( init.selectorInit );
nav.addEventListener( "click", _onClick );

function _onClick( event ) {
    console.log( event.isTrusted ); // will be false on the first click (which is emitted from esm-dynamic-loader).

    //do stuff
}
