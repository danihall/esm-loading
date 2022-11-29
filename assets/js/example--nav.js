import { fake } from "./utils/fake";

const selector = "#nav";
const nav = document.querySelector( selector );
nav.addEventListener( "click", _onClick );

function _onClick( event ) {
    console.log( event.isTrusted ); // will be false on the first click (which is emitted from esm-loader).
    event.currentTarget.dummyNumber = fake;

    //do stuff
}
