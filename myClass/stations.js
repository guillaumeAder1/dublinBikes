require([
        "esri/map",
        "esri/layers/FeatureLayer",
        "esri/request",
        "esri/geometry/Point",
        "esri/graphic",
        "dojo/on",
        "dojo/_base/array",
        "esri/tasks/FeatureSet",
        "dojo/domReady!"
    ],

    function(
        Map,
        FeatureLayer,
        request,
        Point,
        Graphic,
        on,
        array,
        FeatureSet

        ) {

        var map = new Map("map", {
            center: [-6.265, 53.345],
            zoom: 14,
            basemap: "gray",
            logo:false, showAttribution:false
        });


        var APIkeyDublinBike = "cd68da53009a674d943220ef0a67623682aa00ce";
        var data;

        loadJQ();

        function loadJQ(){


            $(document).ready(function(){
                $.ajax({
                    type: "GET",
                    url : "data/Dublin.csv",
                    datatype: "csv",
                    success: function(data) {processData(data);}
                });

            });
        }

        function processData(d) {

            $.ajax({
                type: "GET",
                url: "https://api.jcdecaux.com/vls/v1/stations?contract=dublin&apiKey=cd68da53009a674d943220ef0a67623682aa00ce",
                datatype: "json",
                success: function(d){ getRealTimeData(d)},
                error: function(e){console.log("error request JCdecaux API Data")}

            })

        }

        function getRealTimeData(json){

            var layerDefinition = {
                "displayFieldName": "Name",
                "geometryType": "esriGeometryPoint",
                "spatialReference": {
                    "wkid": 4326
                },
                "fields": [{
                    "name": "ObjectID",
                    "alias": "ObjectID",
                    "type": "esriFieldTypeOID"
                }, {
                    "name": "Name",
                    "type": "esriFieldTypeString",
                    "alias": "Name"
                },{
                    "name": "bike-stands",
                    "type": "esriFieldTypeString",
                    "alias": "bike-stands"
                },{
                    "name": "bike-available",
                    "type": "esriFieldTypeString",
                    "alias": "bike-available"
                },{
                    "name": "bike-stands-available",
                    "type": "esriFieldTypeString",
                    "alias": "bike-stands-available"
                }]
            }



            var jsonFS = {
                "geometryType": "esriGeometryPoint",
                "features":[]
            };

            var t = [];

            for (var i = 0 ; i < json.length ; i ++){

                t[i] = {
                    attributes: {
                        name: json[i].name,
                        ObjectID: json[i].number,
                        bikesStands: json[i].bike_stands,
                        bikeAvailable: json[i].available_bikes,
                        bikeStandAvailable: json[i].available_bike_stands
                    },
                    geometry:{
                        spatialReference: {wkid:4326},
                        x: json[i].position.lng,
                        y: json[i].position.lat
                    }
                }
            }

            jsonFS.features = t;

            var fs = new FeatureSet(jsonFS);
            var featureList = fs.features;


            var featureCollection = {
                layerDefinition: layerDefinition,
                featureSet: fs
            };

            var featureLayer = new FeatureLayer(featureCollection, {
                id:"featureJSON",
                styling:false

            });
            map.addLayer(featureLayer);

            on(featureLayer, "graphic-draw", function(e){

                console.log(e.graphic.attributes);

                e.node.setAttribute("data-name" , e.graphic.attributes.name)
                e.node.setAttribute("data-bike-stand" , e.graphic.attributes.bikesStands)
                e.node.setAttribute("data-bike-available" , e.graphic.attributes.bikeAvailable)
                e.node.setAttribute("data-bike-stands-available" , e.graphic.attributes.bikeStandAvailable)
                e.node.setAttribute("stroke-width",  e.graphic.attributes.bikesStands);



            });
        }
    });
