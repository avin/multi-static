# Multi-static

Tool for developing web applications with complex static hierarchy and need
in flexible modification of the contents of files (both in development and build modes).

## Using

Run dev-server:

```sh
multi-static-dev --config ./config.js
```

Run build:

```sh
multi-static-build --config ./config.js
```

## Configuration options

### • http

Object with web server settings for dev-mode.

#### • http.port

Web server port.

#### • http.https

Use https protocol.

#### • http.key

Certificate key (for https).

#### • http.cert

Certificate (for https).

### • buildPath

Build directory.

### • mapping

Mapping for files.

### • fileDevProcessing

File handling in dev mode.

### • fileBuildProcessing

File handling in build mode.

### • mappingDevLocationRewrite

The function of substituting the destination string from mapping for dev-mode.

### • mappingBuildLocationRewrite

The function of substituting the destination string from mapping for build-mode.

### • beforeBuild

Pre-build function.

### • afterBuild

Post-build function.

### • beforeDevStart

Function before starting dev server. Here you can configure the middlewares for the Express server.

## Configuration examples

A comprehensive usage example can be found in the [./example](example) directory.
