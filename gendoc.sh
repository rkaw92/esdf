#!/bin/bash
shopt -s extglob
rm -r Documentation/APIDOC
jsdoc -d Documentation/APIDOC -t /usr/local/lib/node_modules/jsdoc/templates/docstrap/template -c /usr/local/lib/node_modules/jsdoc/templates/docstrap/jsdoc.conf -r !(node_modules|Documentation)
