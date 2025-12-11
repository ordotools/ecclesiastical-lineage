#!/bin/bash
./env/bin/flask db stamp 20251210_add_wiki_page
./env/bin/flask db upgrade
