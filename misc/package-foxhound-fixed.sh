#!/bin/bash

TF_PATH=${HOME}/project-foxhound
PW_PATH=${HOME}/playwright-1.53.1
MAIN_PATH=${HOME}/Web-Tracking-Detection

TF_DIST_PATH=$TF_PATH/obj-tf-release/dist
PW_PREFS_PATH=$PW_PATH/browser_patches/firefox/preferences

cd $TF_PATH
./mach package

cd $TF_DIST_PATH/foxhound
cat $PW_PREFS_PATH/playwright.cfg $MAIN_PATH/misc/playwright-prefs-extra.txt > playwright.cfg
mkdir -p defaults/pref/
cp $PW_PREFS_PATH/00-playwright-prefs.js defaults/pref/

cd $TF_DIST_PATH
zip -r foxhound.zip foxhound

cd
rm -rf foxhound-fixed*
mv $TF_DIST_PATH/foxhound.zip foxhound-fixed.zip
unzip foxhound-fixed.zip
mv foxhound foxhound-fixed
