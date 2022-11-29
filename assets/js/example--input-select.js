const selector = "input";
const input = document.querySelector( selector );

input.addEventListener( "input", _onInput );

function _onInput( event ) {
    console.log( event );

    // do stuff
}
