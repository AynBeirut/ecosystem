# Electron App - Build Assets

Place icon files here:

- **icon.ico** - Windows icon (256x256, .ico format)
- **icon.icns** - macOS icon (1024x1024, .icns format)
- **icon.png** - Linux icon (512x512, .png format)

## Creating Icons

### From a PNG source (512x512 or larger):

**Windows (.ico):**
- Use online tool: https://icoconvert.com/
- Or ImageMagick: `convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`

**macOS (.icns):**
- Use Icon Composer (Xcode tools)
- Or https://cloudconvert.com/png-to-icns

**Linux (.png):**
- Simply use a 512x512 PNG file

## Placeholder

For now, you can use a placeholder until you have your brand icon ready.
The build will work without icons but will show the default Electron icon.
