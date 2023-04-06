const fs = require('fs');
const { Command } = require('commander');
const colors = require('colors');
const program = new Command();

const PDFDocument = require('pdfkit');
const SVGTOPDF = require('svg-to-pdfkit');
const HanziWriter = require('hanzi-writer');
const sizeData = require('./sizeData.json');
const sizesAvailable = Object.keys(sizeData);
colors.enable();

program
    .name('worksheet-generator')
    .description('CLI to Generate Hanzi Worksheets')
    .version('1.0.0')
    .option('-f, --filename', 'Where to save the generated file', 'example.pdf')
    .option('-c, --characters <strng>', 'Add the characters for the worksheet', '的一是不r 了人$我在有他这为之}大来以个中上们')
    .option('-s, --size <size>', 'Select Paper Size (A6)', 'A6')
    .option('-hh, --hint', 'Include a hint line with stroke order', false)
    .option('-t, --tracing', 'Include tracing prompts on the grid', false)
    .parse();

    const opts = program.opts();
    // Ensure the page size is supported, otherwise stop processing
    if(!sizesAvailable.includes(opts.size)) {
        console.log(`Selected size [${opts.size}] is not supported. Select one of [${sizesAvailable.join('], [')}]`.red);
        process.exit();
    }

    const doc = new PDFDocument({size: opts.size});
    // Remove remove non-chinese characters
    const cleanCharacters = opts.characters.replace(/[^\u4E00-\u9FFF]+/g, '');
    console.log(cleanCharacters);
    const characterList = cleanCharacters.split('');
    const { hintSize, hintSpacing, hintMargin, hintXCorrection, gridSpacing, gridSize, gridCountPerLine, marginTop, marginLeft, rowMargin, characterSize, pageRows} = sizeData[opts.size];
    // Disable hints if tracing enabled
    let hasHint = (opts.tracing) ? false : opts.hint;
    const rowsPerPage = (hasHint) ? pageRows['hint'] : pageRows['noHint'];

    doc.pipe(fs.createWriteStream(opts.filename));

    let pageRow=0;
    for (let i=0; i<characterList.length;i++) {
        // Get the character data
        try {
            const characterData = require(`hanzi-writer-data/${characterList[i]}`);
            pageRow = newPageHandler(pageRow);
            let yRowStart = marginTop + (gridSize*pageRow) + (rowMargin*pageRow);
            pageRow = drawCharacterGrid(doc, characterData, yRowStart, pageRow, opts.tracing);
        }
        catch(e) {
            if(e.message.includes('hanzi-writer-data')) console.log(`Could not find the character "${characterList[i]}". Skipping...`.yellow)
        }
    }

    doc.end();

function drawCharacterGrid(doc, characterData, yStart, pageRow, hasTracing=false) {
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