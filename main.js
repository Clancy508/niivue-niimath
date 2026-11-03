import './style.css'
import { Niivue, NVMeshUtilities, SLICE_TYPE, SHOW_RENDER, MULTIPLANAR_TYPE } from '@niivue/niivue'
import { Niimath } from "@niivue/niimath"

// create niivue instance but don't setup the scene just yet
const nv = new Niivue({
  logLevel: 'debug'
});

// create niimath instance (will be initialized later)
const niimath = new Niimath();
console.log(niimath);


// store a reference to an unedited image for 
// use when the user wants to change the command from the dropdown
let uneditedImage;
let activeUploadedUrl;

async function processImage(isOverlay) {
  loadingCircle.classList.remove('hidden')
  try {
    const imageIndex = 0;
    const niiBuffer = await nv.saveImage({ volumeByIndex: imageIndex })
    const niiFile = new File([niiBuffer], 'image.nii')
    const input = document.getElementById('command');
    const cmd = input.value;
    const imageProcessor = niimath.image(niiFile)
    // check if "mesh" is in the command, and set isMesh
    const isMesh = cmd.includes('mesh')
    // check if "bitmap" is in the command, and set isBitmap
    const isBitmap = cmd.includes('bitmap')
    // create array of commands by separating on spaces
    // trim any leading or trailing whitespace
    const commands = cmd.split(' ').map((c) => c.trim())
    imageProcessor.commands = [...commands]
    const outName = isMesh ? 'mesh.mz3' : isBitmap ? 'bitmap.png' : 'image.nii.gz'
    console.log('ismesh', isMesh);
    console.log(imageProcessor);
    const processedBlob = await imageProcessor.run(outName)
    console.log(processedBlob);
    
    const arrayBuffer = await processedBlob.arrayBuffer()
    if (!isOverlay) {
      nv.removeVolume(nv.volumes[0]);
    }
    
    if (isBitmap) {
      // For bitmap outputs, use arrayBuffer with a name property ending in .png
      await nv.loadVolumes([{ url: arrayBuffer, name: outName }])
    } else {
      // For meshes and nifti files, use loadFromArrayBuffer
      console.log('arrayBuffer', arrayBuffer);
      await nv.loadFromArrayBuffer(arrayBuffer, outName)
    }
    updateMeshDownloadButton();
    
    // set the colormap to the value of the color dropdown
    if (isOverlay) {
      setOverlayColor();
    }
    loadingCircle.classList.add('hidden')
  } catch (error) {
    loadingCircle.classList.add('hidden')
    console.error(error)
  }
}

// respond to our button press
function buttonProcessImage() {
  const isOverlay = overlayCheck.checked;
  processImage(isOverlay);
}

// set overlay opacity
function setOverlayOpacity() {
  const opacityString = overlayOpacity.value;
  const opacity = parseFloat(opacityString);
  if (nv.volumes.length > 1) {
    nv.setOpacity(1, opacity);
  }
}

function setInputOpacity() {
  const opacity = parseFloat(inputOpacity.value);
  if (nv.volumes.length > 0) {
    nv.setOpacity(0, opacity);
  }
}

// set overlay color
function setOverlayColor() {
  const overlayColor = document.getElementById('overlayColor');
  // get the text value of the selected option
  const colormap = overlayColor.options[overlayColor.selectedIndex].text;
  if (nv.volumes.length > 1) {
    nv.setColormap(nv.volumes[1].id, colormap)
  }

  // if meshes are present, set their color too
  if (nv.meshes.length > 0) {
    nv.setMeshProperty(nv.meshes[0].id, 'colormap', colormap);
  }
}

// on reset button click
function reset() {
  // reload the page
  location.reload();
}

// when overlay checkbox is checked hide or show the opacity slider and the color dropdown
function overlayChecked() {
  const overlayOpacity = document.getElementById('overlayOpacity');
  const overlayColor = document.getElementById('overlayColor');
  // get the labels too
  const overlayOpacityLabel = document.getElementById('overlayOpacityLabel');
  const overlayColorLabel = document.getElementById('overlayColorLabel');
  if (overlayCheck.checked) {
    overlayOpacity.style.display = 'inline';
    overlayColor.style.display = 'inline';
    overlayOpacityLabel.style.display = 'inline';
    overlayColorLabel.style.display = 'inline';
  } else {
    overlayOpacity.style.display = 'none';
    overlayColor.style.display = 'none';
    overlayOpacityLabel.style.display = 'none';
    overlayColorLabel.style.display = 'none';
  }
}

// populate overlay color dropdown
function populateOverlayColors() {
  const colormaps = nv.colormaps()
  const overlayColor = document.getElementById('overlayColor')
  for (let i = 0; i < colormaps.length; i++) {
    let option = document.createElement("option");
    option.text = colormaps[i];
    overlayColor.add(option);
  }
  // find the index of red and set it as the default
  const redIndex = colormaps.indexOf('red')
  overlayColor.selectedIndex = redIndex;
}

// populate moreCommands dropdown with some niimath command strings for users to try
function populateMoreCommands() {
  const moreCommands = document.getElementById('moreCommands');
  const commands = [
    '-dehaze -5 -dog 2 3.2',
    '-dehaze -5',
    '-mesh -i m -b',
    '-fmedian',
    '-fmean',
    '-sobel',
    '-sobel_binary',
    '-otsu 5',
    '-recip',
    '-bitmap -x 0.33 0.66 -r -y 0.33 0.66 -r -z 0.33 0.66 basic.png',
    '-bitmap -y 0.33 0.66 -z 0.33 0.66 -X 0.5 -c viridis cross.png',
    '-bitmap -o 0.5 -c inferno optimal.png',
  ];
  for (let i = 0; i < commands.length; i++) {
    let option = document.createElement("option");
    option.text = commands[i];
    moreCommands.add(option);
  }
  // set the default command
  moreCommands.selectedIndex = 0;
}

// when the user selects a command from the moreCommands dropdown
function moreCommandsSelected() {
  const moreCommands = document.getElementById('moreCommands');
  const command = moreCommands.options[moreCommands.selectedIndex].text;
  const input = document.getElementById('command');
  input.value = command;

  // if a mesh is there, remove it
  if (nv.meshes.length > 0) {
    // loop through all meshes and remove them
    for (let i = 0; i < nv.meshes.length; i++) {
      nv.removeMesh(nv.meshes[i]);
    }
  }

  // if an overlay is there, remove it
  if (nv.volumes.length > 1) {
    // loop over all volumes from 1 to the end
    for (let i = 1; i < nv.volumes.length; i++) {
      nv.removeVolume(nv.volumes[i]);
    }
  } else {
    // restore the unedited image
    nv.removeVolume(nv.volumes[0]);
    nv.addVolume(uneditedImage);
  }

  // then click the process button
  buttonProcessImage();
}

async function loadImage(url, name) {
  // remove all meshes and volumes
  for (let i = 0; i < nv.meshes.length; i++) {
    nv.removeMesh(nv.meshes[i]);
  }
  for (let i = 0; i < nv.volumes.length; i++) {
    nv.removeVolume(nv.volumes[i]);
  }
  updateMeshDownloadButton();
  let volumeList = [{ url: url, name },];
  await nv.loadVolumes(volumeList);
  if (activeUploadedUrl && activeUploadedUrl !== url) {
    URL.revokeObjectURL(activeUploadedUrl);
  }
  activeUploadedUrl = url.startsWith('blob:') ? url : undefined;
  // set the unedited image to the loaded image
  uneditedImage = nv.volumes[0];
  nv.updateGLVolume();
}

function updateMeshDownloadButton() {
  const saveMeshButton = document.getElementById('saveMeshButton');
  if (saveMeshButton) saveMeshButton.disabled = nv.meshes.length === 0;
}


async function main() {

  // populate overlay color dropdown
  populateOverlayColors();

  // populate moreCommands dropdown
  populateMoreCommands();

  // set overlay opacity
  overlayOpacity.oninput = setOverlayOpacity;

  // set input opacity
  inputOpacity.oninput = setInputOpacity;

  // set overlay color
  overlayColor.onchange = setOverlayColor;

  // when overlay checkbox is checked
  overlayCheck.onchange = overlayChecked;

  // on reset button click
  resetButton.onclick = reset;

  // when the user selects a command from the moreCommands dropdown
  moreCommands.onchange = moreCommandsSelected;

  const imagePicker = document.getElementById('imagePicker');
  const imagePickerButton = document.getElementById('openImagePickerButton');
  const imageBreadcrumbs = document.getElementById('imageBreadcrumbs');
  const imageFileList = document.getElementById('imageFileList');
  const imagePickerStatus = document.getElementById('imagePickerStatus');
  const imageUpload = document.getElementById('imageUpload');
  let currentImageDirectory = '';

  function renderImageBrowser() {
    imageBreadcrumbs.replaceChildren();
    imageFileList.replaceChildren();
    imagePickerStatus.textContent = '';

    const rootButton = document.createElement('button');
    rootButton.type = 'button';
    rootButton.textContent = 'public';
    rootButton.onclick = () => {
      currentImageDirectory = '';
      renderImageBrowser();
    };
    imageBreadcrumbs.append(rootButton);

    let pathSoFar = '';
    for (const segment of currentImageDirectory.split('/').filter(Boolean)) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment;
      const crumbPath = pathSoFar;
      const crumb = document.createElement('button');
      crumb.type = 'button';
      crumb.textContent = segment;
      crumb.onclick = () => {
        currentImageDirectory = crumbPath;
        renderImageBrowser();
      };
      imageBreadcrumbs.append(crumb);
    }

    const prefix = currentImageDirectory ? `${currentImageDirectory}/` : '';
    const folders = new Set();
    const files = [];
    for (const filePath of window.__PUBLIC_IMAGE_FILES__ || []) {
      if (!filePath.startsWith(prefix)) continue;
      const remainder = filePath.slice(prefix.length);
      const separator = remainder.indexOf('/');
      if (separator >= 0) folders.add(remainder.slice(0, separator));
      else files.push({ path: filePath, name: remainder });
    }

    if (currentImageDirectory) {
      const parentButton = document.createElement('button');
      parentButton.type = 'button';
      parentButton.textContent = '..';
      parentButton.onclick = () => {
        currentImageDirectory = currentImageDirectory.split('/').slice(0, -1).join('/');
        renderImageBrowser();
      };
      imageFileList.append(parentButton);
    }

    for (const folder of [...folders].sort()) {
      const folderButton = document.createElement('button');
      folderButton.type = 'button';
      folderButton.textContent = `${folder}/`;
      folderButton.onclick = () => {
        currentImageDirectory = prefix ? `${prefix}${folder}` : folder;
        renderImageBrowser();
      };
      imageFileList.append(folderButton);
    }

    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      const fileButton = document.createElement('button');
      fileButton.type = 'button';
      fileButton.textContent = file.name;
      fileButton.onclick = async () => {
        imagePickerStatus.textContent = `Loading ${file.name}...`;
        try {
          const assetPath = file.path.split('/').map(encodeURIComponent).join('/');
          await loadImage(new URL(assetPath, document.baseURI).href);
          imagePicker.close();
        } catch (error) {
          imagePickerStatus.textContent = `Unable to load ${file.name}.`;
          console.error(error);
        }
      };
      imageFileList.append(fileButton);
    }

    if (!folders.size && !files.length) {
      const emptyMessage = document.createElement('p');
      emptyMessage.textContent = 'No supported images in this folder.';
      imageFileList.append(emptyMessage);
    }
  }

  imagePickerButton.onclick = () => {
    currentImageDirectory = '';
    renderImageBrowser();
    imagePicker.showModal();
  };

  imageUpload.onchange = async () => {
    const file = imageUpload.files[0];
    if (!file) return;
    const uploadUrl = URL.createObjectURL(file);
    imagePickerStatus.textContent = `Loading ${file.name}...`;
    try {
      await loadImage(uploadUrl, file.name);
      imagePicker.close();
    } catch (error) {
      URL.revokeObjectURL(uploadUrl);
      imagePickerStatus.textContent = `Unable to load ${file.name}.`;
      console.error(error);
    } finally {
      imageUpload.value = '';
    }
  };

  // enable our button after our WASM has been initialize
  function initializeImageProcessing() {
    // await initWasm();
    let button = document.getElementById('processButton');
    button.disabled = false;
    button.onclick = buttonProcessImage;
  }
  saveButton.onclick = function () {
    if (nv.volumes.length < 2)
      nv.saveImage({ filename: "niimath.nii.gz", isSaveDrawing: false, volumeByIndex: 0 });
    else
      nv.saveImage({ filename: "niimath.nii.gz", isSaveDrawing: false, volumeByIndex: 1 });
  }
  const saveMeshButton = document.getElementById('saveMeshButton');
  saveMeshButton.onclick = async function () {
    const mesh = nv.meshes[nv.meshes.length - 1];
    if (!mesh?.tris?.length) return;
    try {
      await NVMeshUtilities.saveMesh(mesh.pts, mesh.tris, 'niimath.stl');
    } catch (error) {
      console.error('Unable to save mesh', error);
    }
  }
  updateMeshDownloadButton();
  aboutButton.onclick = function () {
    const link = "https://github.com/rordenlab/niimath?tab=readme-ov-file#about"
    window.open(link, '_blank');
  }
  helpButton.onclick = function () {
    // open link in new tab
    const link = "https://github.com/rordenlab/niimath/blob/9f3a301be72c331b90ef5baecb7a0232e9b47ba4/src/niimath.c#L259"
    window.open(link, '_blank');
  }

  let canvas = document.getElementById('gl');
  nv.setInterpolation(true);
  nv.attachToCanvas(canvas);
  nv.setSliceType(SLICE_TYPE.MULTIPLANAR)
  nv.setMultiplanarLayout(MULTIPLANAR_TYPE.GRID)
  nv.opts.multiplanarShowRender = SHOW_RENDER.ALWAYS
  var volumeList = [{ url: "./fa8.nii.gz" },];
  await nv.loadVolumes(volumeList);
  uneditedImage = nv.volumes[0];

  // initialize niimath (loads wasm and sets up worker)
  await niimath.init();
  console.log(niimath);

  // enable our button after our WASM has been setup
  initializeImageProcessing();
}

main()