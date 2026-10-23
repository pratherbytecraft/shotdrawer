# Shotdrawer

A menu bar app for macOS that lists your recent screenshots. Click one and its path is copied, ready to paste into Terminal, a chat or an upload box. Free to use.

## Install

```
npm install -g shotdrawer
shotdrawer
```

Shotdrawer needs Node 18 or newer. The install also adds Shotdrawer to the Applications folder in your home folder, so you can open it again from Spotlight. It lives in the menu bar and has no Dock icon. Opening it again while it's running opens the list.

## Uninstall

```
npm uninstall -g shotdrawer
```

Then move Shotdrawer from the Applications folder in your home folder to the Trash.

## What it does

Click the viewfinder icon in the menu bar to open the list. The newest screenshots are at the top, grouped under Today, Yesterday and Earlier, each with its time and size. Hold the pointer on one to see its file name. Click one and its path is copied.

Command click picks several, Shift click picks a run of them, and pressing on a row and moving across others picks those too. Copy Paths copies them all at once, one per line, space separated, or shell quoted, set on the General page. Esc clears the picks.

Drag a picture out of the list to drop the file into another app. Right click a screenshot for Copy Path, Copy as file:// URL, Copy Filename, Show in Finder, Open, Remove from History and Move to Trash.

The folder button at the bottom shows where the Mac saves screenshots and can change it, for the screenshot tool too. A change made in the screenshot tool's Options menu shows up in Shotdrawer right away. Clear History empties the list and leaves the files where they are.

## Settings

Open Shotdrawer Settings from the gear in the list or the menu bar icon's right click. General sets how many screenshots the list keeps, how several paths are copied, the screenshot folder and open at login. Look switches the list between List and Grid. About has the update check.

Shotdrawer opens at login from its first launch. Switch it off on the General page.

## With Filedrawer

When Filedrawer is installed, Show in Finder becomes Show in Filedrawer, and Filedrawer opens the folder with the screenshot picked. The General page switches it back to Finder.

## Folder access

macOS asks before Shotdrawer reads your Desktop or Documents folder for the first time, and that's where screenshots usually go. If you said no, the list shows a button that opens Privacy & Security, where you can switch it on under Files & Folders.

## Updates

Shotdrawer checks for a newer version now and then and shows it on the About page. It never installs anything by itself. To update, run `npm install -g shotdrawer` again, then quit Shotdrawer and open it. The About page shows the line that fits your copy, with a Copy button.

## Help

Open an issue at https://github.com/pratherbytecraft/shotdrawer/issues.

## License

Copyright 2026 Prather Bytecraft. All rights reserved. Shotdrawer is free to install and use, and its source code can be read, but it can't be copied, changed or shared. See LICENSE.
