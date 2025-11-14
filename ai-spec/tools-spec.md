# System Name
Internal Tools Page

## Overview
This will be a set of scripts for internal tools for the SWUnivesity app. The two separate tools should be:
- DOWNLOADER: image downloader for SWUDB patterns we have in both Quiz mode and Do You Know SWU mode
- CONVERTER: PNG to WEBP converter for existing images in either the swudb-import or dykswu folders found in public/assets

## Requirements
### Functional Requirements
- DOWNLOADER-REQ-1: from the quiz-database.json file, read every item in the "relevantCards" array that belongs to each quiz item and download the image using the pattern found in the "getSWUDBImageLink" function which looks like `https://swudb.com/cdn-cgi/image/quality=1/images/cards/${cardPattern}.png`
- DOWNLOADER-REQ-2: from the dykswu-database.json file, read every item in the "actualCard" property of DYKSWU entries and download the image using the pattern found in the "getSWUDBImageLink" function which looks like `https://swudb.com/cdn-cgi/image/quality=1/images/cards/${cardPattern}.png`
- DOWNLOADER-REQ-3: images downloaded from SWUDB should be saved to the "public/assets/swudb-import" folder with the name similar to the read pattern, however instead of SET/123 numbers it should be SET_123 numbers, replacing slash with underscores for the file names
- DOWNLOADER-REQ-4: if a PNG already exists for the pattern, then don't download it again
- DOWNLOADER-REQ-5: if a WEBP already exists for the pattern, then don't download it again

- CONVERTER-REQ-1: convert PNGs to WEBPs automatically
- CONVERTER-REQ-2: images to convert should be from the "public/assets/swudb-import" and also from the "public/assets/dykswu" folders
- CONVERTER-REQ-3: conversions should be made in-place. WEBPs will be created sibling to their PNG counterparts. and then PNGs that are already converted are to be removed
- CONVERTER-REQ-4: if a conversion already exists, then don't convert it again

### Data Requirements
- DOWNLOADER-DATA-1: images downloaded from SWUDB as PNGs

- CONVERTER-DATA-1: images converted to webp with a maximum size of 50kB; preferred size of 30kB

## Constraints
### Technical Constraints
applies to both tools
- TECH-1: ViteJS/nodeJS
- TECH-2: deployed through Vercel

## Validation Criteria
- [ ] TEST-1: after DOWNLOADER is run, every unique card from the quiz-database.json's "relevantCards" arrays has a corresponding PNG in the swudb-import folder
- [ ] TEST-2: after CONVERTER is run, PNGs are cleaned up from relevant folders and only WEBPs are left