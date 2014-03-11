@echo off
uglifyjs js\AIRAliases.js -o js\AIRAliases.min.js -c -m && uglifyjs js\lib.js -o js\lib.min.js -c -m && uglifyjs js\app.js -o js\app.min.js -c -m && uglifycss default.css > default.min.css