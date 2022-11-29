# how to use
To see the final output when executing the config, run `yarn prod` (will babelify, minify the code as well as creating a bundle for legacy browsers);
or run `yarn dev` (enables watch mode, disable minification which by the way elminates the need to create source-maps).

You will see in *dist/dev|prod/js* the created files, along the most important one: `graph.json`.
This file contains all the important informations about each module, and can then be used server-side to render a page.

Some pseudo-js to illustrate what can be done with the graph server-side:
```javascript
    GRAPH = parse(graph.json);
    MODULES_IN_PAGE = [];
    DYNAMIC_MODULES = { onClick: null, onFocusIn: null, onIntersection: null, onInjection: null };

    GRAPH.forEach( entry => {
        if ( entry["loadingPoint"] === "onInjection" ) {
            DYNAMIC_MODULES["onInjection"][ entry["selectorInit"] ] = entry["moduleFile"];
            return;
        }

        if ( selectorIsInHTML( entry["selectorInit"] ) ) {
            if ( entry["loadingPoint"] !== "static" ) {
                DYNAMIC_MODULES[ entry["loadingPoint"] ][ entry["selectorInit"] ] = entry["moduleFile"];
            } else {
               MODULES_IN_PAGE.push(entry);
            }
        }
    } );

    DEPENDENCIES_IN_PAGE = MODULES_IN_PAGE.flatMap( entry => entry["helperFiles"] );
    DEPENDENCIES_IN_PAGE = [...new Set(DEPENDENCIES_IN_PAGE)];// deduplication of helper files

    LINKS = DEPENDENCIES_IN_PAGE.map( dependency => `<link rel="modulepreload" href="${dependency}"/>` );
    SCRIPTS = MODULES_IN_PAGE.map( entry => `<script type="module" src="${entry["moduleFile"]}"></script>` );
    JSON_DYNAMIC_MODULES = `<script type="app/json" id="esm-loading-map">${JSON.stringify( DYNAMIC_MODULES )}</script>`;

    html = htmlInsertInHead( LINKS + SCRIPTS + JSON_DYNAMIC_MODULES );
    res.send( html );
```
The `<links rel="modulepreload">` are the flattened list of the dependencies used by the main modules. If HTTP/2 is enbled on your server, this can provide a great boost at load time.

The `JSON_DYNAMIC_MODULES` can be parsed at runtime by the script `esm-dynamic-loader.js`. It will load scripts on demand depending on user interaction (you can see the list of triggering interactions below - but feel free to add your own!).

All in all, the minimum amount of JS will be downloaded by the browser!

If you wish you can add an entry to the **"modules"** object in *assets/js/index.json*.
A valid entry is key (value = path of your module relative to assets/js) and a associated value (value = object of `options`).
For details about the object of `options` paired with the module's path, see below.

## about options
Here are the options you can use to fine-grain the final output of the es-modules:
- `loadingPoint`: default to `static`, otherwise can be:
    - `onClick`
    - `onFocusIn`
    - `onIntersection`
    - `onInjection` (warning: my own pubsub implementation is used in lieu of a mutationObserver for better performances, but feel free to change the logic!)
- `priority`: will add fetchpriority hints on `<link>` and `<script>`, but more importantly can be used to fine-grain in which order modules are loaded, thus having a predictive order of modules execution:
    - `very-high`, `high`, `low`