const viewer = new Cesium.Viewer("cesiumContainer", {
    baseLayerPicker: false,
  });
  const imageryLayers = viewer.imageryLayers;
  
  const viewModel = {
    layers: [],
    baseLayers: [],
    upLayer: null,
    downLayer: null,  
    selectedLayer: null,
    isSelectableLayer: function (layer) {
      return this.baseLayers.indexOf(layer) >= 0;
    },
    raise: function (layer, index) {
      imageryLayers.raise(layer);
      viewModel.upLayer = layer;
      viewModel.downLayer = viewModel.layers[Math.max(0, index - 1)];
      updateLayerList();
      window.setTimeout(function () {
        viewModel.upLayer = viewModel.downLayer = null;
      }, 10);
    },
    lower: function (layer, index) {
      imageryLayers.lower(layer);
      viewModel.upLayer =
        viewModel.layers[
          Math.min(viewModel.layers.length - 1, index + 1)
        ];
      viewModel.downLayer = layer;
      updateLayerList();
      window.setTimeout(function () {
        viewModel.upLayer = viewModel.downLayer = null;
      }, 10);
    },
    canRaise: function (layerIndex) {
      return layerIndex > 0;
    },
    canLower: function (layerIndex) {
      return layerIndex >= 0 && layerIndex < imageryLayers.length - 1;
    },
  };
  const baseLayers = viewModel.baseLayers;
  
  Cesium.knockout.track(viewModel);
  
  function setupLayers() {
    // Create all the base layers that this example will support.
    // These base layers aren't really special.  It's possible to have multiple of them
    // enabled at once, just like the other layers, but it doesn't make much sense because
    // all of these layers cover the entire globe and are opaque.
    addBaseLayerOption("Bing Maps Aerial", undefined); // the current base layer
    addBaseLayerOption(
      "Bing Maps Road",
      Cesium.createWorldImagery({
        style: Cesium.IonWorldImageryStyle.ROAD,
      })
    );
    addBaseLayerOption(
      "ArcGIS World Street Maps",
      new Cesium.ArcGisMapServerImageryProvider({
        url:
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
      })
    );
    addBaseLayerOption(
      "OpenStreetMaps",
      new Cesium.OpenStreetMapImageryProvider()
    );
    addBaseLayerOption(
      "Stamen Maps",
      new Cesium.OpenStreetMapImageryProvider({
        url: "https://stamen-tiles.a.ssl.fastly.net/watercolor/",
        fileExtension: "jpg",
        credit:
          "Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under CC BY SA.",
      })
    );
    addBaseLayerOption(
      "Natural Earth II (local)",
      new Cesium.TileMapServiceImageryProvider({
        url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
      })
    );
    addBaseLayerOption(
      "USGS Shaded Relief (via WMTS)",
      new Cesium.WebMapTileServiceImageryProvider({
        url:
          "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/WMTS",
        layer: "USGSShadedReliefOnly",
        style: "default",
        format: "image/jpeg",
        tileMatrixSetID: "default028mm",
        maximumLevel: 19,
        credit: "U. S. Geological Survey",
      })
    );
  
    // Create the additional layers
    addAdditionalLayerOption(
      "United States GOES Infrared",
      new Cesium.WebMapServiceImageryProvider({
        url:
          "https://mesonet.agron.iastate.edu/cgi-bin/wms/goes/conus_ir.cgi?",
        layers: "goes_conus_ir",
        credit: "Infrared data courtesy Iowa Environmental Mesonet",
        parameters: {
          transparent: "true",
          format: "image/png",
        },
      })
    );
    addAdditionalLayerOption(
      "United States Weather Radar",
      new Cesium.WebMapServiceImageryProvider({
        url:
          "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi?",
        layers: "nexrad-n0r",
        credit: "Radar data courtesy Iowa Environmental Mesonet",
        parameters: {
          transparent: "true",
          format: "image/png",
        },
      })
    );
  
    addAdditionalLayerOption(
      "Grid",
      new Cesium.GridImageryProvider(),
      1.0,
      false
    );
    
    addAdditionalLayerOption(
      "Nearmap",
        new Cesium.UrlTemplateImageryProvider({
         url : 'https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg?tertiary=satellite&apikey=' + (typeof NEARMAP_KEY !== "undefined" ? NEARMAP_KEY : ""),
         customTags : {
         Time: function(imageryProvider, x, y, level) {
             }
           }
         
      })
    );
    addAdditionalLayerOption(
      "Tile Coordinates",
      new Cesium.TileCoordinatesImageryProvider(),
      1.0,
      false
    );
  }
  
  function addBaseLayerOption(name, imageryProvider) {
    let layer;
    if (typeof imageryProvider === "undefined") {
      layer = imageryLayers.get(0);
      viewModel.selectedLayer = layer;
    } else {
      layer = new Cesium.ImageryLayer(imageryProvider);
    }
  
    layer.name = name;
    baseLayers.push(layer);
  }
  
  function addAdditionalLayerOption(name, imageryProvider, alpha, show) {
    const layer = imageryLayers.addImageryProvider(imageryProvider);
    layer.alpha = Cesium.defaultValue(alpha, 0.5);
    layer.show = Cesium.defaultValue(show, true);
    layer.name = name;
    Cesium.knockout.track(layer, ["alpha", "show", "name"]);
  }
  
  function updateLayerList() {
    const numLayers = imageryLayers.length;
    viewModel.layers.splice(0, viewModel.layers.length);
    for (let i = numLayers - 1; i >= 0; --i) {
      viewModel.layers.push(imageryLayers.get(i));
    }
  }
  
  setupLayers();
  updateLayerList();
  
  //Bind the viewModel to the DOM elements of the UI that call for it.
  const toolbar = document.getElementById("toolbar");
  Cesium.knockout.applyBindings(viewModel, toolbar);
  
  Cesium.knockout
    .getObservable(viewModel, "selectedLayer")
    .subscribe(function (baseLayer) {
      // Handle changes to the drop-down base layer selector.
      let activeLayerIndex = 0;
      const numLayers = viewModel.layers.length;
      for (let i = 0; i < numLayers; ++i) {
        if (viewModel.isSelectableLayer(viewModel.layers[i])) {
          activeLayerIndex = i;
          break;
        }
      }
      const activeLayer = viewModel.layers[activeLayerIndex];
      const show = activeLayer.show;
      const alpha = activeLayer.alpha;
      imageryLayers.remove(activeLayer, false);
      imageryLayers.add(baseLayer, numLayers - activeLayerIndex - 1);
      baseLayer.show = show;
      baseLayer.alpha = alpha;
      updateLayerList();
    });
  