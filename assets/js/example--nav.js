import { fake } from "./utils/fake";

const selectorInit = "#nav";
const nav = document.querySelector( selectorInit );
nav.addEventListener( "click", _onClick );

function _onClick( event ) {
    console.log( event.isTrusted ); // will be false on the first click (which is emitted from esm-dynamic-loader).
    event.currentTarget.dependenciesCount = fake;

    //do stuff
}
