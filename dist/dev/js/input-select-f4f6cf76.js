const init = {
    selectorInit: "input"
};
const input = document.querySelector( init.selectorInit );

input.addEventListener( "input", _onInput );

function _onInput( event ) {
    console.log( event );

    // do stuff
}
