const fs = require('fs');
const PDFDocument = require('pdfkit');
const SVGTOPDF = require('svg-to-pdfkit');
const doc = new PDFDocument({size: 'A6'});
const HanziWriter = require('hanzi-writer');     

doc.pipe(fs.createWriteStream('test.pdf'));

const hasTracing = true;
let hasHint = true;

const hintSize = 10;
const hintSpacing=1;
const hintMargin=4;
const hintXCorrection = 15; // Not sure why this is necessary

const gridSpacing = 4;
const gridSize = 35;
const gridCountPerLine = 7;

const marginTop = 25;
const marginLeft = 10;
const rowMargin = 6;

const characterSize = 45;
const characterString = '我最喜歡的顏是綠色或紅色';
const characterList = characterString.split('');

if(hasTracing) hasHint = false;
const rowsPerPage = (hasHint) ? 7 : 9;

let pageRow=0;
for (let i=0; i<characterList.length;i++) {
    // Get the character data
    const characterData = require(`hanzi-writer-data/${characterList[i]}`);
    pageRow = newPageHandler(pageRow);
    let yRowStart = marginTop + (gridSize*pageRow) + (rowMargin*pageRow);
    pageRow = drawCharacterGrid(doc, characterData, yRowStart, pageRow);
}


// finalize the PDF and end the stream
doc.end();

function drawCharacterGrid(doc, characterData, yStart, pageRow) {
    if(hasHint) {
        yStart += ((hintMargin + hintSize) * pageRow);
        generateHint(doc, characterData, hintSize, marginLeft, yStart-(hintMargin + hintSize), hintSpacing);
    }

    let rowCount = (!hasTracing) ? 1 : Math.ceil((characterData.strokes.length+1) / gridCountPerLine);
    for(let i=0;i<rowCount;i++) {
        pageRow = newPageHandler(pageRow);
        let yRowStart = (hasTracing) ? marginTop + (gridSize*pageRow) + (rowMargin*pageRow) : yStart;
        for (let g=0;g<gridCountPerLine;g++) {
            let xStart = marginLeft + (g * gridSize) + (g*gridSpacing);
            drawGrid(doc, xStart, yRowStart, gridSize);

            let strokeNumber = (i * gridCountPerLine) + g;
            if(i===0 && g===0) {
                let svg = getCharacterSvg(characterData, characterSize);
                SVGTOPDF(doc, svg, marginLeft, yStart);
            }
            else if(strokeNumber <= characterData.strokes.length && hasTracing) {
                let strokeNumber = (i * gridCountPerLine) + g;
                let svg = getCharacterSvg(characterData, characterSize, {strokeCount: strokeNumber, opacity: '0.3'});
                SVGTOPDF(doc, svg, xStart, yRowStart);
            }
        }
        // Draw the initial example character
        pageRow++;
    }
    return pageRow;
}

function newPageHandler(pageRow) {
    if(pageRow > 0 && pageRow%rowsPerPage == 0) {
        doc.addPage();
        //Reset the page Row
        pageRow=0;
    }
    return pageRow;
}

function drawGrid(doc, xstart, ystart, size, strokeColor='#ddd', outlineColor='#000') {
    doc.path(`M ${xstart},${ystart} L ${xstart+size},${ystart+size}`).stroke(strokeColor)
    doc.path(`M ${xstart+size},${ystart} L ${xstart},${ystart+size}`).stroke(strokeColor)
    doc.path(`M ${xstart+(size/2)},${ystart} L ${xstart+(size/2)},${ystart+size}`).stroke(strokeColor)
    doc.path(`M ${xstart},${ystart+(size/2)} L ${xstart+size},${ystart+(size/2)}`).stroke(strokeColor)
    
    doc.path(`M ${xstart},${ystart+size} L ${xstart+size},${ystart+size}`).stroke(outlineColor)
    doc.path(`M ${xstart},${ystart} L ${xstart+size},${ystart}`).stroke(outlineColor)
    doc.path(`M ${xstart},${ystart} L ${xstart},${ystart+size}`).stroke(outlineColor)
    doc.path(`M ${xstart+size},${ystart} L ${xstart+size},${ystart+size}`).stroke(outlineColor)
}

function drawGridRow(yStart) {
    // Draw multiple grids on the current row
    for (let g=0;g<gridCountPerLine;g++) {
        let xStart = marginLeft + (g * gridSize) + (g*gridSpacing);
        drawGrid(doc, xStart, yStart, gridSize);
    }
}

function getCharacterSvg(data, size, opts={strokeColor:"#000", strokeCount:null, opacity:'1' }) {
    let transformData = HanziWriter.getScalingTransform(size, size, 1);
    let svg = `<svg opacity="${opts.opacity}"><g transform="${transformData.transform}">`;
    let strokelimit = (opts.strokeCount === null) ? data.strokes.length : opts.strokeCount;
    for(let i=0; i<strokelimit; i++) {
        svg += `<path d="${data.strokes[i]}" stroke="${opts.strokeColor}" stroke-opacity="${opts.strokeOpacity}"></path>`;
    }
    svg += `</g></svg>`;
    return svg;
}

function generateHint(doc, data, size, xStart, yStart, spacing, strokeColor='#000') {
    let charSize = fixCharacterSize(size);
    for(let i=0; i<=data.strokes.length;i++) {
        let charSvg = getCharacterSvg(data, charSize, {strokeColor: strokeColor, strokeCount: i})
        let xChar = xStart + (spacing * i) + (size * i);
        SVGTOPDF(doc, charSvg, xChar-hintXCorrection, yStart);
    }
}

function fixCharacterSize(size) {
    return size+5;
}