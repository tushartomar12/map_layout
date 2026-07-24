const fs = require('fs');
const path = require('path');

const sketchesDir = path.join(__dirname, '../public/plot-sketches');
const TOTAL_PLOTS = 182;

function checkSketches() {
  if (!fs.existsSync(sketchesDir)) {
    console.log(`\nDirectory not found: ${sketchesDir}`);
    return;
  }

  const files = fs.readdirSync(sketchesDir);
  let manualCount = 0;
  
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file, ext);
    const plotId = parseInt(name, 10);
    
    if ((ext === '.png' || ext === '.jpg' || ext === '.jpeg') && !isNaN(plotId)) {
      manualCount++;
    }
  });

  const autoCount = TOTAL_PLOTS - manualCount;
  const percentComplete = ((manualCount / TOTAL_PLOTS) * 100).toFixed(1);

  console.log('\n=============================================');
  console.log('       PLOT SKETCH MIGRATION PROGRESS        ');
  console.log('=============================================');
  console.log(` Total Plots:       ${TOTAL_PLOTS}`);
  console.log(` Manual Images:     ${manualCount} (${percentComplete}%)`);
  console.log(` Auto-generated:    ${autoCount}`);
  console.log('=============================================\n');
}

checkSketches();
