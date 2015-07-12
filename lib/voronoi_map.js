const demoCoords = {
  lon: 103.75 + Math.random()*.2, 
  lat: 1.28 + Math.random()*.15
}
var toggle = true

showHide = function(selector) {
  d3.select(selector).select('.hide').on('click', function(){
    d3.select(selector)
      .classed('visible', false)
      .classed('hidden', true);
  });

  d3.select(selector).select('.show').on('click', function(){
    d3.select(selector)
      .classed('visible', true)
      .classed('hidden', false);
  });
}
var rad = function(x) {
  return x * Math.PI / 180;
};
var getDistance = function(p1, p2) {
  var R = 6378137; // Earth’s mean radius in meter
  var dLat = rad(p2[0] - p1[0]);
  var dLong = rad(p2[1] - p1[1]);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(p1[0])) * Math.cos(rad(p2[0])) *
    Math.sin(dLong / 2) * Math.sin(dLong / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d; // returns the distance in meter
};


voronoiMap = function(map, url, initialSelections) {
  var pointTypes = d3.map();
  var points = [];
  var lastSelectedPoint;

  var voronoi = d3.geom.voronoi()
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; });

  var selectPoint = function() {
    d3.selectAll('.selected').classed('selected', false);

    var cell = d3.select(this),
        point = cell.datum();

    lastSelectedPoint = point;
    cell.classed('selected', true);

    var distance = parseInt(getDistance([point.latitude, point.longitude], [demoCoords.lat, demoCoords.lon]))

    d3.select('#selected h1')
      .html('')
      .append('a')
        .text(point.name + ' - ' + point.zipCode + ' - ' + distance + 'm')
        .attr('target', '_blank')
    d3.select('#selected p')
      .html('')
      .append('a')
        .text(point.description)
        .attr('target', '_blank')
    d3.select('#selected').style('height', function(){
      return point.description.length / window.innerWidth /.75 * 150 + 30 + 'px'
    })

    var line = [
      L.latLng(point.latitude, point.longitude), 
      L.latLng(demoCoords.lat, demoCoords.lon)
    ];
    var polyline_options = {
      color: '#800000',
      weight: '1px',
      className: 'linkage'
    };
    var polyline = L.polyline(line, polyline_options).addTo(map);
  }

  var drawPointTypeSelection = function() {
    showHide('#selections')
    labels = d3.select('#toggles').selectAll('input')
      .data(pointTypes.values())
      .enter().append("label");

    labels.append("input")
      .attr('type', 'checkbox')
      .property('checked', function(d) {
        return initialSelections === undefined || initialSelections.has(d.type)
      })
      .attr("value", function(d) { return d.type; })
      .on("change", drawWithLoading);

    labels.append("span")
      .attr('class', 'key')
      .style('background-color', function(d) { return '#' + d.color; });

    labels.append("span")
      .text(function(d) { return d.type; });
  }

  var selectedTypes = function() {
    return d3.selectAll('#toggles input[type=checkbox]')[0].filter(function(elem) {
      return elem.checked;
    }).map(function(elem) {
      return elem.value;
    })
  }

  var pointsFilteredToSelectedTypes = function() {
    var currentSelectedTypes = d3.set(selectedTypes());
    return points.filter(function(item){
      return currentSelectedTypes.has(item.type);
    });
  }

  var drawWithLoading = function(e){
    d3.select('#loading').classed('visible', true);
    if (e && e.type == 'viewreset') {
      d3.select('#overlay').remove();
    }
    setTimeout(function(){
      draw();
      d3.select('#loading').classed('visible', false);
    }, 0);
  }

  var draw = function() {
    d3.select('#overlay').remove();

    var bounds = map.getBounds(),
        topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
        bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
        existing = d3.set(),
        drawLimit = bounds.pad(0.4);

    filteredPoints = pointsFilteredToSelectedTypes().filter(function(d) {

      var latlng = new L.LatLng(d.latitude, d.longitude);

      if (!drawLimit.contains(latlng)) { return false };

      var point = map.latLngToLayerPoint(latlng);

      key = point.toString();
      if (existing.has(key)) { return false };
      existing.add(key);

      d.x = point.x;
      d.y = point.y;
      return true;
    });

    voronoi(filteredPoints).forEach(function(d) { d.point.cell = d; });

    var svg = d3.select(map.getPanes().overlayPane).append("svg")
      .attr('id', 'overlay')
      .attr("class", "leaflet-zoom-hide")
      .style("width", map.getSize().x + 'px')
      .style("height", map.getSize().y + 'px')
      .style("margin-left", topLeft.x + "px")
      .style("margin-top", topLeft.y + "px");

    var g = svg.append("g")
      .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    var svgPoints = g.attr("class", "points")
      .selectAll("g")
        .data(filteredPoints)
      .enter().append("g")
        .attr("class", "point");

    var buildPathFromPoint = function(point) {
      return "M" + point.cell.join("L") + "Z";
    }

    var pathArray = []
    svgPoints.append("path")
      .attr("class", "point-cell")
      .each(function(d) {
        pathArray.push(buildPathFromPoint(d))
      })
      .attr("d", buildPathFromPoint)
      .on('click', selectPoint)
      .classed("selected", function(d) { return lastSelectedPoint == d} );

    //Attempting canvas integrations
  /*d3.ns.prefix.custom = "http://github.com/mbostock/d3/examples/dom";
    var sketch = d3.select(map.getPanes().overlayPane).append('canvas')
      .attr('id', 'canvas')
      .style("width", map.getSize().x + 'px')
      .style("height", map.getSize().y + 'px')
      .style("margin-left", topLeft.x + "px")
      .style("margin-top", topLeft.y + "px")
      .style('position', 'absolute')
      .style('z-index', -1)
      .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");
    pathArray.forEach(function(path) {
      var canvas = document.getElementById('canvas');
      var ctx = canvas.getContext('2d');
      ctx.strokeStyle = 'maroon';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'pink'

      var p = new Path2D(path);
      ctx.stroke(p);
    })
  */

    svgPoints.append("circle")
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .style('fill', function(d) { return '#' + d.color } )
      .attr("r", function(d) {
        if('r' in d)
          return d.r
        return 2
      });
  }

  var mapLayer = {
    onAdd: function(map) {
      map.on('viewreset moveend', drawWithLoading);
      drawWithLoading();
    }
  };

  showHide('#about');

  map.on('ready', function() {
    var _results = []
    var index = 1
    var files = ['recycling_bins', 'ewaste', 'secondhandcollection']
    var colorScale = d3.scale.category10()

    files.forEach(function(type) {
      d3.json('data/' + type + '.json', function(json){
        json.forEach(function(row, i){
          if(i === 1)
            index += i
          if(i > 1)
            index += 1
          var color = colorScale(type).split('#')[1]
          var zipCode = row.properties.description.split('<b>')[1].split('</b>')[0].split('- ')[1]
          var description = row.properties.description.split('<b>')[2].split('</b>')[0].split('- ')[1]
          _results.push({
            color: color,
            id: String(index),
            latitude: String(row.geometry.coordinates[1]),
            longitude: String(row.geometry.coordinates[0]),
            name: row.properties.name,
            type: type,
            zipCode: zipCode,
            description: description
          })
          pointTypes.set(type, {type: type, color: color});
        })
        points = _results
        drawPointTypeSelection();
        map.addLayer(mapLayer);
        console.log(points.length)
      })
    })
    getLocation()
  });
  
  function toGeoJSON(arr) {
    var featureCollection = arr.map(function(item) {
      return {
        "type": "Feature",
        "properties": {
          color: item.color,
          description: item.description,
          name: item.name,
          id: item.id
        },
        "geometry": {
          "type": "Point",
          "coordinates": [item.latitude, item.longitude]
        }
      }
    })
    return {
      "type": "FeatureCollection",
      "features": featureCollection
    }
  }
  function geoJSONSimple(lat, lon){
    return {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "Point",
        "coordinates": [lat, lon]
      }
    };
  }
  
  function getLocation(){
    navigator.geolocation.getCurrentPosition(function(geoposition){
      var latitude = geoposition.coords.latitude
      var longitude = geoposition.coords.longitude

      var locLayer = L.mapbox.featureLayer({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [demoCoords.lon, demoCoords.lat]//[latitude, longitude]
        },
        properties: {
          title: 'Current Location',
          'marker-size': 'large',
          'marker-color': '#800000',
          'marker-symbol': 'circle-stroked'
        }
      }).addTo(map);


      locLayer.on('click', function(e){
        console.log('clicked')
        map.setView([demoCoords.lat, demoCoords.lon], 17)
        if(toggle){
          pointsFilteredToSelectedTypes().filter(function(center) {

            var distance = getDistance(
              [center.latitude, center.longitude], 
              [demoCoords.lat, demoCoords.lon]
            );
            var count = 0
            if(distance < 1000){
              count++
              var line = [
                L.latLng(center.latitude, center.longitude), 
                L.latLng(demoCoords.lat, demoCoords.lon)
              ];
              var polyline_options = {
                color: '#800000',
                weight: '1px',
                className: 'linkage',
                opacity: .2
              };
              var polyline = L.polyline(line, polyline_options).addTo(map);
            }
          })
        }else{
          d3.selectAll('.linkage').remove()
        }
        toggle = !toggle
      })
    });
  }
}