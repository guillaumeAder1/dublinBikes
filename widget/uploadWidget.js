define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom",
    "dojo/mouse",
    "dojo/on",
    "dojo/_base/array",
    "dojo/_base/Deferred",
    "dojo/dom-style",
    "dojox/data/CsvStore",
    "dojox/encoding/base64",
    "esri/geometry/Point",
    "esri/geometry/webMercatorUtils",
    "esri/layers/FeatureLayer",
    "esri/InfoTemplate",
    "esri/map",
    "esri/SpatialReference",
    "esri/tasks/GeometryService",
    "esri/tasks/ProjectParameters",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dojo/text!./templates/UploadLayer.html"

], function (

    declare, lang, dom, mouse, on, arrayUtils, Deffered,
    domStyle, CsvStore, base64, Point, WebMercatorUtils,
    FeatureLayer, InfoTemplate, Map,
    SpatialReference, GeometryService, ProjectParameters,
    _WidgetBase, _TemplatedMixin, template

    ) {

    return declare([_WidgetBase, _TemplatedMixin], {

        // Our template - important!
        templateString: template,
        // A class to be applied to the root node in our template
        baseClass: "uploadLayerWidget",
        latFieldStrings: ["lat", "latitude", "y", "ycenter"],
        longFieldStrings: ["lon", "long", "longitude", "x", "xcenter"],
        currentMap: null,
        fileName: null,
        dropZone: null,
        asyncDeffered:null,
        urlSymbol:null,


        constructor: function (param) {

            /*
            TO DO

            - register the new upload layer properly to save the map in AGOL as well as for removing from layerList
                issue when make_a_map : removeFromMap is triggered  (service.data.url doesn't match with and AGOL service)
                - we could try to register our new layer as a featureLayer or GraphicLayer in AGOL account after the CSV handle function

            - Handle for other types of Data (.shp)

            - define "symbol picker" in the popup to allow different symbols for the Data ( by default is set to redCircle.png in generateFeatureCollectionTemplateCSV(); )
            
            */



            this.currentMap = param
        },

        postCreate: function () {
            // Get a DOM node reference for the root of our widget
            var domNode = this.domNode;
            this.inherited(arguments);
            this.layerAdded();
        },

        layerAdded: function () {         

            this.dropZone = dom.byId("dropZone");

            on(dropZone, "dragenter", function (evt) {
                evt.preventDefault();                
                domStyle.set(dropZone, {
                    "border": "4px dashed grey",
                });
            });

            on(dropZone, "dragover", function (evt) {
                evt.preventDefault();
            });

            on(dropZone, "drop", lang.hitch(this, this.handleDrop));          

        },

        handleDrop: function (event) {

            event.preventDefault();

            domStyle.set(dropZone, {
                "border": "4px dashed lightgrey",
            });

            var dataTransfer = event.dataTransfer,
                files = dataTransfer.files,
                types = dataTransfer.types;

            if (files && files.length === 1) {
                console.log("[ FILES ]");
                var file = files[0]; 
                console.log("type = ", file.type + " Name === " + file.name);

                if (file.type.indexOf("image/") !== -1) {
                    // handle for other type of data (shp ...)
                    // handleImage(file, event.layerX, event.layerY);
                }
                else if (file.name.indexOf(".csv") !== -1) {                  
                    lang.hitch(this, this.handleCSV(file));
                }        
            }

            this.fileName = file.name

        },

        handleCSV: function (file) {

            //if (file.data) {
            //    var decoded = this.bytesToString(base64.decode(file.data));
            //    processCSVData(decoded);
            //}
            //else {
                var reader = new FileReader();
            //reader.onload = function () {
            //    console.log("Finished reading CSV data");
            //   lang.hitch(this,  this.processCSVData(reader.result));
            //};
               
                reader.onload = lang.hitch(this, function () {
                    this.processCSVData(reader.result)
                });
                reader.readAsText(file);

        },

        bytesToString : function (b) {
            console.log("bytes to string");
            var s = [];
            arrayUtils.forEach(b, function (c) {
                s.push(String.fromCharCode(c));
            });
            return s.join("");
        },


        processCSVData: function (data) {

            var newLineIndex = data.indexOf("\n");
            var firstLine = lang.trim(data.substr(0, newLineIndex));
            var separator =  this.getSeparator(firstLine);
            var csvStore = new CsvStore({
                data: data,
                separator: separator
            });
            var that = this;

            this.asyncDeffered = new Deffered();

            csvStore.fetch({
                onComplete: function (items) {
                   
                    var objectId = 0;

                    var featureCollection = that.generateFeatureCollectionTemplateCSV(csvStore, items)

                    var popupInfo = that.generateDefaultPopupInfo(featureCollection)                   

                    var infoTemplate = new InfoTemplate(that.buildInfoTemplate(popupInfo));

                    var latField, longField;

                    var fieldNames = csvStore.getAttributes(items[0]);

                    var gs = new GeometryService("http://sampleserver6.arcgisonline.com/arcgis/rest/services/Utilities/Geometry/GeometryServer");

                    arrayUtils.forEach(fieldNames, function (fieldName) {

                        var matchId;
                        matchId = arrayUtils.indexOf(that.latFieldStrings, fieldName.toLowerCase());
                        if (matchId !== -1) {
                            latField = fieldName;
                        }

                        matchId = arrayUtils.indexOf(that.longFieldStrings, fieldName.toLowerCase());
                        if (matchId !== -1) {
                            longField = fieldName;
                        }

                    });                   

                    var i = 0;
                    var featureLayer;

                    arrayUtils.forEach(items, function (item) {

                        var attrs = csvStore.getAttributes(item), attributes = {};
                        // Read all the attributes for  this record/item
                        arrayUtils.forEach(attrs, function (attr) {
                            var value = Number(csvStore.getValue(item, attr));
                            attributes[attr] = isNaN(value) ? csvStore.getValue(item, attr) : value;
                        });

                        attributes["__OBJECTID"] = objectId;
                        objectId++;
                        var latitude = parseFloat(attributes[latField]);
                        var longitude = parseFloat(attributes[longField]);

                        if (isNaN(latitude) || isNaN(longitude)) {
                            return;
                        }
                        var geometry = new Point(longitude, latitude, new SpatialReference({ wkid: 4326 }));
                        var pjr = new ProjectParameters();
                        pjr.geometries = [geometry];
                        pjr.outSR = new SpatialReference({ wkid: 102100 });

                        gs.project(pjr, function (outpoint) {

                            i++;
                            var feature = {
                                "geometry": outpoint[0].toJson(),
                                "attributes": attributes
                            };
                            featureCollection.featureSet.features.push(feature)
                          
                            if (i == items.length - 1) {                               

                                featureLayer = new FeatureLayer(featureCollection, {
                                    infoTemplate: infoTemplate,
                                    url: "customerData/" + that.fileName,
                                    id: 'csvLayer_' + new Date().getTime().toString()
                                });
                               
                                featureLayer.__popupInfo = popupInfo;
                                featureLayer.name = that.fileName;  
                                that.asyncDeffered.resolve(featureLayer);
                            }
                        });
                    });

                },
                onError: function (error) {
                    console.error("Error fetching items from CSV store: ", error);
                }
            })

            this.asyncDeffered.then(function (layer) {
                console.log(layer)
                layer.spatialReference = new SpatialReference({wkid : 102100});
                console.log( that.currentMap.map.spatialReference)
                that.currentMap.map.addLayer(layer);


            }, function (err) {
                alert("error");
            });

        },

        generateFeatureCollectionTemplateCSV: function (store, items) {
            //create a feature collection for the input csv file
            var featureCollection = {
                "layerDefinition": null,
                "featureSet": {
                    "features": [],
                    "geometryType": "esriGeometryPoint"
                }
            };
	
            featureCollection.layerDefinition = {
                "geometryType": "esriGeometryPoint",
                "objectIdField": "__OBJECTID",
                "type": "Feature Layer",
                "typeIdField": "",
                "drawingInfo": {
                    "renderer": {
                        "type": "simple",
                        "symbol": {
                            "type": "esriPMS",
                            "url": this.urlSymbol,
                            //"imageData": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAGXRFWHRTb2Z0d2FyZQBQYWludC5ORVQgdjMuNS4xTuc4+QAAB3VJREFUeF7tmPlTlEcexnve94U5mANQbgQSbgiHXHINlxpRIBpRI6wHorLERUmIisKCQWM8cqigESVQS1Kx1piNi4mW2YpbcZONrilE140RCTcy3DDAcL/zbJP8CYPDL+9Ufau7uqb7eZ7P+/a8PS8hwkcgIBAQCAgEBAICAYGAQEAgIBAQCAgEBAICAYGAQEAgIBAQCDx/AoowKXFMUhD3lQrioZaQRVRS+fxl51eBTZUTdZ41U1Rox13/0JF9csGJ05Qv4jSz/YPWohtvLmSKN5iTGGqTm1+rc6weICOBRbZs1UVnrv87T1PUeovxyNsUP9P6n5cpHtCxu24cbrmwKLdj+osWiqrVKhI0xzbmZ7m1SpJ+1pFpvE2DPvGTomOxAoNLLKGLscZYvB10cbYYjrJCb7A5mrxleOBqim+cWJRakZY0JfnD/LieI9V1MrKtwokbrAtU4Vm0A3TJnphJD4B+RxD0u0LA7w7FTE4oprOCMbklEGNrfdGf4IqnQTb4wc0MFTYibZqM7JgjO8ZdJkpMln/sKu16pHZGb7IfptIWg389DPp9kcChWODoMuDdBOhL1JgpisbUvghM7AqFbtNiaFP80RLnhbuBdqi0N+1dbUpWGde9gWpuhFi95yL7sS7BA93JAb+Fn8mh4QujgPeTgb9kAZf3Apd2A+fXQ38yHjOHozB1IAJjOSEY2RSIwVUv4dd4X9wJccGHNrJ7CYQ4GGjLeNNfM+dyvgpzQstKf3pbB2A6m97uBRE0/Ergcxr8hyqg7hrwn0vAtRIKIRX6Y2pMl0RhIj8co9nBGFrvh55l3ngU7YObng7IVnFvGS+BYUpmHziY/Ls2zgP9SX50by/G9N5w6I+ogYvpwK1SoOlHQNsGfWcd9Peqof88B/rTyzF9hAIopAByQzC0JQB9ST5oVnvhnt+LOGsprvUhxNIwa0aY7cGR6Cp7tr8+whkjawIxkRWC6YJI6N+lAKq3Qf/Tx+B77oGfaQc/8hB8w2Xwtw9Bf3kzZspXY/JIDEbfpAB2BKLvVV90Jvjgoac9vpRxE8kciTVCBMMkNirJ7k/tRHyjtxwjKV4Yp3t/6s+R4E+/DH3N6+BrS8E314Dvvg2+/Sb4hxfBf5sP/up2TF3ZhonK1zD6dhwGdwail26DzqgX8MRKiq9ZBpkSkmeYOyPM3m9Jjl+1Z9D8AgNtlAq6bZ70qsZi+q+bwV/7I/hbB8D/dAr8Axq89iz474p/G5++koHJy1sx/lkGdBc2YjA3HF0rHNHuboomuQj/5DgclIvOGCGCYRKFFuTMV7YUAD3VDQaLMfyqBcZORGPy01QKYSNm/rYV/Nd/Av9NHvgbueBrsjDzRQamKKDxT9Kgq1iLkbIUDOSHoiNcgnYHgnYZi+9ZExSbiSoMc2eE2flKcuJLa4KGRQz6/U0wlGaP0feiMH4uFpMXEjBVlYjp6lWY+SSZtim0kulYMiYuJEJXuhTDJ9UYPByOvoIwdCxfgE4bAo0Jh39xLAoVpMwIEQyTyFCQvGpLon9sJ0K3J4OBDDcMH1dj9FQsxkrjMPFRPCbOx2GyfLal9VEcxstioTulxjAFNfROJPqLl6Bnfyg6V7ugz5yBhuHwrZjBdiU5YJg7I8wOpifAKoVIW7uQ3rpOBH2b3ekVjYT2WCRG3o+mIGKgO0OrlIaebU/HYOQDNbQnojB4NJyGD0NPfjA0bwTRE6Q7hsUcWhkWN8yZqSQlWWGECAZLmJfJmbrvVSI8taK37xpbdB/wQW8xPee/8xIGjvlj8IQ/hk4G0JbWcX8MHPVDX4kveoq8ocn3xLM33NCZRcPHOGJYZIKfpQyq7JjHS6yJjcHujLHADgkpuC7h8F8zEVqXSNC2awE69lqhs8AamkO26HrbDt2H7dBVQov2NcW26CiwQtu+BWjdY4n2nZboTbfCmKcCnRyDO/YmyLPnDlHvjDH8G6zhS9/wlEnYR7X00fWrFYuWdVI0ZpuhcbcczW/R2qdAcz6t/bRov4mONeaaoYl+p22rHF0bVNAmKtBvweIXGxNcfFH8eNlC4m6wMWMusEnKpn5hyo48pj9gLe4SNG9QoGGLAk8z5XiaJUd99u8122/IpBA2K9BGg2vWWKAvRYVeLzEa7E1R422m2+MsSTem97nSYnfKyN6/mzATv7AUgqcMrUnmaFlLX3ysM0fj+t/b5lQLtK22QEfyAmiSLKFZpUJ7kBRPXKW4HqCYynWVHKSG2LkyZex1uO1mZM9lKem9Tx9jjY5iNEYo0bKMhn7ZAu0r6H5PpLXCAq0rKJClSjSGynE/QIkrQYqBPe6S2X+AJsY2Ped6iWZk6RlL0c2r5szofRsO9R5S1IfQLRCpQL1aifoYFerpsbkuTImaUJXuXIDiH6/Ys8vm3Mg8L2i20YqsO7fItKLcSXyn0kXccclVqv3MS6at9JU/Ox+ouns+SF6Z4cSupz7l8+z1ucs7LF1AQjOdxfGZzmx8Iu1TRcfnrioICAQEAgIBgYBAQCAgEBAICAQEAgIBgYBAQCAgEBAICAQEAv8H44b/6ZiGvGAAAAAASUVORK5CYII=",
                            "contentType": "image/png",
                            "width": 15,
                            "height": 15
                        }
                    }
                },
                "fields": [
                  {
                      "name": "__OBJECTID",
                      "alias": "__OBJECTID",
                      "type": "esriFieldTypeOID",
                      "editable": false,
                      "domain": null
                  }
                ],
                "types": [],
                "capabilities": "Query"
            };

            var fields = store.getAttributes(items[0]);
            arrayUtils.forEach(fields, function (field) {
                var value = store.getValue(items[0], field);
                var parsedValue = Number(value);
                if (isNaN(parsedValue)) { //check first value and see if it is a number
                    featureCollection.layerDefinition.fields.push({
                        "name": field,
                        "alias": field,
                        "type": "esriFieldTypeString",
                        "editable": true,
                        "domain": null
                    });
                }
                else {
                    featureCollection.layerDefinition.fields.push({
                        "name": field,
                        "alias": field,
                        "type": "esriFieldTypeDouble",
                        "editable": true,
                        "domain": null
                    });
                }
            });

            return featureCollection;
        },

        generateDefaultPopupInfo: function (featureCollection) {


            var fields = featureCollection.layerDefinition.fields;
            var decimal = {
                'esriFieldTypeDouble': 1,
                'esriFieldTypeSingle': 1
            };
            var integer = {
                'esriFieldTypeInteger': 1,
                'esriFieldTypeSmallInteger': 1
            };
            var dt = {
                'esriFieldTypeDate': 1
            };
            var displayField = null;
            var fieldInfos = arrayUtils.map(fields, lang.hitch(this, function (item) {

                  if (item.name.toUpperCase() === "NAME") {
                      displayField = item.name;
                  }
                  var visible = (item.type !== "esriFieldTypeOID" &&
                                 item.type !== "esriFieldTypeGlobalID" &&
                                 item.type !== "esriFieldTypeGeometry");
                  var format = null;
                  if (visible) {
                      var f = item.name.toLowerCase();
                      var hideFieldsStr = ",stretched value,fnode_,tnode_,lpoly_,rpoly_,poly_,subclass,subclass_,rings_ok,rings_nok,";
                      if (hideFieldsStr.indexOf("," + f + ",") > -1 ||
                          f.indexOf("area") > -1 || f.indexOf("length") > -1 ||
                          f.indexOf("shape") > -1 || f.indexOf("perimeter") > -1 ||
                          f.indexOf("objectid") > -1 || f.indexOf("_") == f.length - 1 ||
                          f.indexOf("_i") == f.length - 2) {
                          visible = false;
                      }
                      if (item.type in integer) {
                          format = {
                              places: 0,
                              digitSeparator: true
                          };
                      }
                      else if (item.type in decimal) {
                          format = {
                              places: 2,
                              digitSeparator: true
                          };
                      }
                      else if (item.type in dt) {
                          format = {
                              dateFormat: 'shortDateShortTime'
                          };
                      }
                  }

                  return lang.mixin({}, {
                      fieldName: item.name,
                      label: item.alias,
                      isEditable: false,
                      tooltip: "",
                      visible: visible,
                      format: format,
                      stringFieldOption: 'textbox'
                  });
            }));

            var popupInfo = {
                title: displayField ? '{' + displayField + '}' : '',
                fieldInfos: fieldInfos,
                description: null,
                showAttachments: false,
                mediaInfos: []
            };


            return popupInfo;
        },

        getSeparator: function (string) {
            var separators = [",", "      ", ";", "|"];
            var maxSeparatorLength = 0;
            var maxSeparatorValue = "";
            arrayUtils.forEach(separators, function (separator) {
                var length = string.split(separator).length;
                if (length > maxSeparatorLength) {
                    maxSeparatorLength = length;
                    maxSeparatorValue = separator;
                }
            });
            return maxSeparatorValue;
        },

        buildInfoTemplate: function (popupInfo) {
            var json = {
                content: "<table>"
            };

            arrayUtils.forEach(popupInfo.fieldInfos, function (field) {
                if (field.visible) {
                    json.content += "<tr><td valign='top'>" + field.label +
                                    ": <\/td><td valign='top'>${" + field.fieldName + "}<\/td><\/tr>";
                }
            });
            json.content += "<\/table>";

            return json;
        },

        changeSymbol: function(url){
            this.urlSymbol = url;
            $("#dropdownSymbol").attr("src" , url);
        },

        clearMap: function(){

            this.currentMap.map.graphics.clear();
            var layerIds =  this.currentMap.map.graphicsLayerIds.slice(0);
            layerIds = layerIds.concat( this.currentMap.map.layerIds.slice(1));

            arrayUtils.forEach(layerIds, lang.hitch(this, function (layerId) {
                this.currentMap.map.removeLayer( this.currentMap.map.getLayer(layerId));
            }));
            console.log(this.currentMap.map.graphics);
//            this.currentMap.map.removeLayer
        }

    });
});