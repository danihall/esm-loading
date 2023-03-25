# esm-loading
Configuration for efficient ES modules loading

Nodejs >= 16.12.0 required.
## what's this for ?
This repo demonstrates how to efficiently load JS files on a website using a twofold strategy:
* creating a graph at build time to list all es-modules and add only the necessary ones when requesting the server.
* using native dynamic loading in JS to react to a user interaction.

ES-Modules are available in all modern browsers, this opens up new possibilities regarding Javascript loading.
Instead of creating a bundle that concatenates all JS files, with ES-Modules it's possible to just load files individually, bringing advantages like:
> - faster cold load of your JS if coupled with HTTP/2
> - lower TTI (*Time To Interactive*)
> - lower TBT (*Total Blocking Time*)
> - if a module has changed, no need to reload a whole bundle
> - when Import Maps (https://github.com/WICG/import-maps) are available, even less file reloading if a dependency has changed

**Those are just the plain-to-see advantages, but why not go further and dynamically load es-modules on user interaction?
This way, only one (tiny) file is needed on page load, the rest is loaded individually on demand.**

Since most of the time we write JS scripts that respond to a user interaction, we can load an es-module when a specific `Event` is registered on specific `HTMLElement`.

All sorts of event are very well suited for this kind of logic, any event that can be delegated can be the "trigger" of an es-module loading.

## how does it work?
This repo consists of:
- a Rollup config (`rollup.config.js` and `rollup.utils.js`) that analyses js files and builds a graph as a JSON to map modules to their dependencies (as well as other optional stuff)
- a module `esm-loader.js` *(assets/js/esm-loader.js)* whose purpose is to dynamically load modules following the logic previously mentionned.

> These 3 files are at the core of my esm loading strategy, feel free to inspect them.

Rollup is used with a specific config to build files and do the "Rollup things" like tree-shaking, minifying, etc.
Added to the final ouput, Rollup API is used to create a `graph.json` that will contain key information about each module you wish to load on the browser.

> This file *graph.json* is what the Rollup config is used for, its purpose is to be used Server Side to:
> - compare the HTML and the selectors listed in the graph to add the corresponding scripts and links.
> - build a new JSON that lists the modules to be loaded dynamically.

The entry point of your files fed to Rollup should be a `index.json` *(assets/js/index.json)*, having this shape:
```json
{
  "modules": {
    "module_1.js": { "loadingPoint": "click" },
    "modules_2.js": { "loadingPoint": "focusin" }
  },
  "domPolyfills": [
    ...dom APis that aren't poyfilled by Babel
  ]
}
```

A quick example of an output `graph.json` given the aformentionned `index.js`:
```json
[
  "module_1.js": {
    "selector": ".js-module_1",
    "fileName": "module_1-hashmd5orshaxxx.js",
    "loadingPoint": "click",
    "dependencies": [
      "helper_1.js",
      "helper_2.js"
    ]
  },
  "module_2.js": {
    "selector": "[js-module_2]",
    "fileName": "module_2-hashmd5orshaxxx.js",
    "loadingPoint": "focusin",
    "dependencies": [
      "helper_1.js",
      "helper_3.js"
    ]
  }
]
```

The resulting graph can be used server-side to add `<script type="module">` (for main modules) and `<link rel="modulepreload">` (for their dependencies) to a page.

This way, only the strict necessary JS is loaded on a page, something that is impossible with a classic bundle.js.

But most importantly, the key "loadingPoint" can be used to specify if a module is to be loaded dynamically, lowering the amount of js loading, parsing & execution on page load even more!

## about dynamic loading
For `Events`, the script `esm-loader.js` just checks if an event is detected on an element linked to an es-module, if that is the case, a simple dynamic import (`import(...)`) is used.
There is a special case for `click` event as the `esm-loader.js` will dispatch a custom `click Event` after the module.s is.are dynamically loaded.
Which can be useful if your module acts on a click event like, well, a lot of modules we write actually.

Here is a list of events and DOM APIs that are used to dynamically load a module:
- `click`
- `focusin`: useful for elements like `<input>`, `<form>`, etc
- `IntersectionObserver`: load a module when related Element is in viewport

The `MutationObserver` API could have been used to dynamically load a module when a specific HTML is injected in the page, but this requires to observe all nodes and their descendants (subtree: true) on a page, which can be costly performance-wise. Instead, it is better to use a publish/subscribe system to notify the module `esm-loader.js` that HTML has been injected, the module will simply search for any selector in the injected String and load the corresponding module if a match is found.
It's up to you tu create the publish/subscribe system, although for the sake of the example, a file `pubsub.js` is located in this repo.

# how to use
Don't forget to run `yarn` to install the project dependencies.
To see the final output when executing the config, run `yarn prod` (will babelify, minify the code as well as creating a bundle for legacy browsers);
or run `yarn dev` (enables watch mode, disable minification which by the way elminates the need to create source-maps).

You will see in *dist/dev|prod/js* the created files, along the most important one: `graph.json`.
This file contains all the important informations about each module, and can then be used server-side to render a page.

Some naïve pseudo-js to illustrate what can be done with the graph server-side:
```javascript
    GRAPH = parse(graph.json);
    MODULES_IN_PAGE = [];
    DYNAMIC_MODULES = {};
    JSON_DYNAMIC_MODULES = "";

    GRAPH.forEach( entry => {
        if ( entry.loadingPoint === "onInjection" ) {

          DYNAMIC_MODULES.onInjection = Object.assign(
            DYNAMIC_MODULES.onInjection ?? {},
            { [entry.selector]: entry.moduleFile }
          );
          return;
        }

        if ( selectorIsInHTML( entry.selector ) ) {
          if ( entry.loadingPoint !== "static" ) {

            DYNAMIC_MODULES[ entry.loadingPoint ] = Object.assign(
              DYNAMIC_MODULES[ entry.loadingPoint ] ?? {},
              { [ entry.selector ]: entry.moduleFile }
            );

          } else {
            MODULES_IN_PAGE.push(entry);
          }
        }
    } );

    DEPENDENCIES_IN_PAGE = MODULES_IN_PAGE.flatMap( entry => entry.dependencies );
    DEPENDENCIES_IN_PAGE = [...new Set(DEPENDENCIES_IN_PAGE)];// deduplication of helper files

    LINKS = DEPENDENCIES_IN_PAGE.map( dependency => `<link rel="modulepreload" href="${dependency}"/>` );
    SCRIPTS = MODULES_IN_PAGE.map( entry => `<script type="module" src="${entry.moduleFile}"></script>` );

    if ( Object.keys(DYNAMIC_MODULES).length ) {
      JSON_DYNAMIC_MODULES = `<script type="app/json" id="esm-load-map">${JSON.stringify( DYNAMIC_MODULES )}</script>`;
    }

    html = htmlInsertInHead( LINKS + SCRIPTS + JSON_DYNAMIC_MODULES );
    res.send( html );
```
The `<links rel="modulepreload">` are the flattened list of the dependencies used by the main modules. If HTTP/2 is enabled on your server, this can provide a great boost at load time.

The `JSON_DYNAMIC_MODULES` can be parsed at runtime by the script `esm-loader.js`. It will load scripts on demand depending on user interaction (you can see the list of triggering interactions below - but feel free to add your own!).

All in all, the minimum amount of JS will be downloaded by the browser!

If you wish you can add an entry to the **"modules"** object in *assets/js/index.json*.
A valid entry is key (value = path of your module relative to assets/js) and a associated value (value = object of `options`).
For details about the object of `options` paired with the module's path, see below.

## about testing
As there is some server-side logic to be written, this is up to you.
It's important that you test this with HTTP/2 enabled to see the real gain of this strategy.

## about options
Here are the options you can use to fine-grain the final output of the es-modules:
- `loadingPoint`: default to `static`, otherwise can be:
    - `onClick`
    - `onFocusIn`
    - `onIntersection`
    - `onInjection` (warning: my own pubsub implementation is used in lieu of a mutationObserver for better performances, but feel free to change the logic!)
- `priority`: will add fetchpriority hints on `<link>` and `<script>`, but more importantly can be used to fine-grain in which order modules are loaded, thus having a predictive order of modules execution:
    - `very-high`, `high`, `low`

## about selectors
As explained above, an es-module must have a selector for it to be found in a HTML.
> This means, in the code of your module, you must have a variable named "selector" that holds the CSS selector of the HTMLElement linked to your module.
> For example in this repo, the file `example--nav.js` contains:
> ```javascript
> const selector = "#nav";
> const nav = document.querySelector( selector );
> nav.addEventListener( "click", _onClick );
> ```
Notice how `selector` is a simple variable assigment, not a property of an object literal.
It is important to have in the code some kind of *"needle in a haystack"* to search for, it might make the code more verbose but in the end, when minified, the code will look like this:
```javascript
const n = document.querySelector( "#nav" );
n.addEventListener( "click", c );
```
And that'll be okay since the `graph.json` created at build-time is all you need to properly load the modules.

# to conclude
With ES-Modules now supported in pretty much all browsers, it is possible to push the boundaries of what can be optimized at runtime for loading performances.
As the spec evolve and browsers fine-tune their implementations, I predict that, in the not-so-distant-future, pushing those boundaries will barely require any bundler regarding the JS we write.

If you tested this repo, found a bug or just want some information, you can contact me at [danielhalle82@gmail.com](mailto:danielhalle82@gmail.com)

