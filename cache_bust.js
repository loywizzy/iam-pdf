const fs = require('fs');
const path = require('path');

const directoryPath = __dirname;

const files = fs.readdirSync(directoryPath).filter(file => file.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(directoryPath, file), 'utf8');

    // Cache bust style.css
    content = content.replace(/href="css\/style\.css"/g, 'href="css/style.css?v=' + Date.now() + '"');
    content = content.replace(/href="css\/style\.css\?v=\d+"/g, 'href="css/style.css?v=' + Date.now() + '"');

    fs.writeFileSync(path.join(directoryPath, file), content, 'utf8');
    console.log(`Cache busted for ${file}`);
});
