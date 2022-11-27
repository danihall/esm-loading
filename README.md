# esm-loading
example of implementation of an es-modules based loading strategy

## what's this for ?
This repo demonstrates how to efficiently load JS files on a website.

ES-Modules are available in all modern browsers, this opens up new possibilities regarding Javascript loading.
Instead of creating a bundle that concatenates all JS files, with ES-Modules it's possible to just load files individually, bringing advantages like:
- faster loading of your JS if coupled with HTTP/2
- lower TTI (*Time To Interactive*)
- lower TBT (*Total Blocking Time*)
- if a module has changed, no need to reload a whole bundle
- when Import Maps (https://github.com/WICG/import-maps) are available, event less file reloading if a dependency has changed

Those are just the plain-to-see advantages, but why not go further and dynamically load es-modules on user interaction?
This way, only one (tiny) file is needed on page load, the rest is loaded individually on demand.

Since most of the time we write JS scripts that respond to a user interaction, we can load an es-module when a specific `Event` is registered on specific `HTMLElement`.

All sorts of event are very well suited for this kind of logic, any event that can be delegated can be the "trigger" of an es-module loading.

## how does it work?
This repo consists of:
- a Rollup config that analyses js files and builds a graph as a JSON to map modules to their dependencies (as well as other optional stuff)
- a module `esm-loading.js` whose purpose is to dynamically load modules following the logic previously mentionned.

Rollup is used with a specific config to build files and do the "Rollup things" like tree-shaking, minifying, etc.
Added to the final ouput, Rollup API is used to create a `graph.json` that will contain key information about each module you wish to load on the browser.

A quick dumb example of an output:
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


The resulting graph can be used server-side to add <script type="module"> (for main modules) and <link rel="modulepreload"> (for their dependencies) to a page.

This way, only the strict necessary JS is loaded on a page, something that is impossible with a classic bundle.js.

But most importantly, the key "loadingPoint" can be used to specify if a module is to be loaded dynamically, lowering the amount of js loading, parsing & execution on page load even more!
  
## about dynamic loading
A simple dynamic import (`import(...)`) is used.
  
Here is a list of events and DOM APIs that are used to dynamically load a module:
- `click`
- `focusin` useful for elements like <input>, <form>, etc
- `IntersectionObserver` load a module when related Element is in viewport
  
The `MutationObserver` API could have been used to dynamically load a module when a specific HTML is injected in the page, but this requires to observe all nodes and their descendants (subtree: true) on a page, which can be costly performance-wise. Instead, it is better to use a publish/subscribe system to notify the module `esm-loading.js` that HTML has been injected, the module will simply search for any selector in the injected String and load the corresponding module if a match is found.
It's up to you tu create the publish/subscribe system, although for the sake of the example, a file `pubsub.js` is located in this repo.
