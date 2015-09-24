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
            zoom: 5,
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
                type:"GET",
                url: "https://api.jcdecaux.com/vls/v1/contracts?&apiKey=" + APIkeyDublinBike,
                datatype:"json",
                success: function(d){
                    console.log(d)
                    generateSelect(d);
                },
                error: function(e){
                    console.log(e)

                }
            })

        }

        function generateSelect(list){

            var select = document.getElementById("listCity");

            for (var i = 0 ; i < list.length ; i ++){
                var o = document.createElement("option");
                o.text = list[i].name;
                select.add(o);
            }

            select.addEventListener("change" , function(e){
                generateLayer(select.value)
            })
        }

        function generateLayer(city){
            $.ajax({
                type: "GET",
                url: "https://api.jcdecaux.com/vls/v1/stations?contract=" + city + "&apiKey=" + APIkeyDublinBike,
                datatype: "json",
                success: function(d){ getRealTimeData(d)},
                error: function(e){console.log("error request JCdecaux API Data")}

            })

        }

        function getRealTimeData(json){
            console.log(json)
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
                },{
                    "name": "time",
                    "type": "esriFieldTypeString",
                    "alias": "time"
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
                        bikeStandAvailable: json[i].available_bike_stands,
                        time: json[i].last_update
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

            console.log(featureLayer)

            on(featureLayer, "graphic-draw", function(e){

                console.log(e.graphic.attributes);

                e.node.setAttribute("data-name" , e.graphic.attributes.name)
                e.node.setAttribute("data-bike-stand" , e.graphic.attributes.bikesStands)
                e.node.setAttribute("data-bike-available" , e.graphic.attributes.bikeAvailable)
                e.node.setAttribute("data-bike-stands-available" , e.graphic.attributes.bikeStandAvailable)
                e.node.setAttribute("stroke-width",  e.graphic.attributes.bikesStands);
                e.node.setAttribute("data-timestamp",  e.graphic.attributes.time);

                e.node.setAttribute("stroke-opacity",analyseOpacity(e.graphic.attributes));

                d3.select(e.node).on("click", function(e){
                    //console.log(this)
                    //e.preventDefault();
                    d3.event.preventDefault();
                    generatePie(this);
                    displayData(this);
                });
            });
        }

        function analyseOpacity(data){
            var opacity;
            var t = data.bikeStandAvailable;
            var b = data.bikeAvailable;
            var p = t + b;
            var u = (b * 100) / p;

            u = Math.round(u);

console.log(Number( "0." + u))
            return Number( "0." + u);
        }
        function displayData(e){
            $(document).ready(function(){
                $(".name").html(d3.select(e).attr("data-name"));
                $(".bikes").html(d3.select(e).attr("data-bike-available") + " Bike(s) free ");
                $(".stands").html(d3.select(e).attr("data-bike-stands-available") + " Stand(s) free");

                var d = new Date(Number(d3.select(e).attr("data-timestamp")));


                $(".time").html("Last update : " + d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear() + " At " + d.getHours() + "." + d.getMinutes());
            })
        }

        var u = 0;
        function generatePie(e){
//            u ++;
//            console.log(u)
//            d3.select(e.node).append("g").attr("id", "toto" + u );
            var i = d3.select(e).attr("data-bike-available")
            var v = d3.select(e).attr("data-bike-stands-available")


            var chart = c3.generate({

                bindto: "#ipo",
                data: {
                    columns:[
                        ["bikes", i],
                        ["stands", v]
                    ],
                    axes: {
                        data2: 'y2'
                    },
                    types: {
                        bikes: 'donut',
                        stands: 'donut'
                    },
                    labels:true
                },
                color: {
                    pattern: ['#FFE6E6', '#FFB2B2']
                },
                axis: {
                    x: {
                        tick: {
                            culling: true
                        }
                    },
                    y: {
                        show:false
                    }
                }
            })

        }
    });
