(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = {
   hcluster: require("./hcluster"),
   Kmeans: require("./kmeans"),
   kmeans: require("./kmeans").kmeans
};
},{"./hcluster":3,"./kmeans":4}],2:[function(require,module,exports){
module.exports = {
  euclidean: function(v1, v2) {
      var total = 0;
      for (var i = 0; i < v1.length; i++) {
         total += Math.pow(v2[i] - v1[i], 2);      
      }
      return Math.sqrt(total);
   },
   manhattan: function(v1, v2) {
     var total = 0;
     for (var i = 0; i < v1.length ; i++) {
        total += Math.abs(v2[i] - v1[i]);      
     }
     return total;
   },
   max: function(v1, v2) {
     var max = 0;
     for (var i = 0; i < v1.length; i++) {
        max = Math.max(max , Math.abs(v2[i] - v1[i]));      
     }
     return max;
   }
};
},{}],3:[function(require,module,exports){
var distances = require("./distance");

var HierarchicalClustering = function(distance, linkage, threshold) {
   this.distance = distance;
   this.linkage = linkage;
   this.threshold = threshold == undefined ? Infinity : threshold;
}

HierarchicalClustering.prototype = {
   cluster : function(items, snapshotPeriod, snapshotCb) {
      this.clusters = [];
      this.dists = [];  // distances between each pair of clusters
      this.mins = []; // closest cluster for each cluster
      this.index = []; // keep a hash of all clusters by key
      
      for (var i = 0; i < items.length; i++) {
         var cluster = {
            value: items[i],
            key: i,
            index: i,
            size: 1
         };
         this.clusters[i] = cluster;
         this.index[i] = cluster;
         this.dists[i] = [];
         this.mins[i] = 0;
      }

      for (var i = 0; i < this.clusters.length; i++) {
         for (var j = 0; j <= i; j++) {
            var dist = (i == j) ? Infinity : 
               this.distance(this.clusters[i].value, this.clusters[j].value);
            this.dists[i][j] = dist;
            this.dists[j][i] = dist;

            if (dist < this.dists[i][this.mins[i]]) {
               this.mins[i] = j;               
            }
         }
      }

      var merged = this.mergeClosest();
      var i = 0;
      while (merged) {
        if (snapshotCb && (i++ % snapshotPeriod) == 0) {
           snapshotCb(this.clusters);           
        }
        merged = this.mergeClosest();
      }
    
      this.clusters.forEach(function(cluster) {
        // clean up metadata used for clustering
        delete cluster.key;
        delete cluster.index;
      });

      return this.clusters;
   },
  
   mergeClosest: function() {
      // find two closest clusters from cached mins
      var minKey = 0, min = Infinity;
      for (var i = 0; i < this.clusters.length; i++) {
         var key = this.clusters[i].key,
             dist = this.dists[key][this.mins[key]];
         if (dist < min) {
            minKey = key;
            min = dist;
         }
      }
      if (min >= this.threshold) {
         return false;         
      }

      var c1 = this.index[minKey],
          c2 = this.index[this.mins[minKey]];

      // merge two closest clusters
      var merged = {
         left: c1,
         right: c2,
         key: c1.key,
         size: c1.size + c2.size
      };

      this.clusters[c1.index] = merged;
      this.clusters.splice(c2.index, 1);
      this.index[c1.key] = merged;

      // update distances with new merged cluster
      for (var i = 0; i < this.clusters.length; i++) {
         var ci = this.clusters[i];
         var dist;
         if (c1.key == ci.key) {
            dist = Infinity;            
         }
         else if (this.linkage == "single") {
            dist = this.dists[c1.key][ci.key];
            if (this.dists[c1.key][ci.key] > this.dists[c2.key][ci.key]) {
               dist = this.dists[c2.key][ci.key];
            }
         }
         else if (this.linkage == "complete") {
            dist = this.dists[c1.key][ci.key];
            if (this.dists[c1.key][ci.key] < this.dists[c2.key][ci.key]) {
               dist = this.dists[c2.key][ci.key];              
            }
         }
         else if (this.linkage == "average") {
            dist = (this.dists[c1.key][ci.key] * c1.size
                   + this.dists[c2.key][ci.key] * c2.size) / (c1.size + c2.size);
         }
         else {
            dist = this.distance(ci.value, c1.value);            
         }

         this.dists[c1.key][ci.key] = this.dists[ci.key][c1.key] = dist;
      }

    
      // update cached mins
      for (var i = 0; i < this.clusters.length; i++) {
         var key1 = this.clusters[i].key;        
         if (this.mins[key1] == c1.key || this.mins[key1] == c2.key) {
            var min = key1;
            for (var j = 0; j < this.clusters.length; j++) {
               var key2 = this.clusters[j].key;
               if (this.dists[key1][key2] < this.dists[key1][min]) {
                  min = key2;                  
               }
            }
            this.mins[key1] = min;
         }
         this.clusters[i].index = i;
      }
    
      // clean up metadata used for clustering
      delete c1.key; delete c2.key;
      delete c1.index; delete c2.index;

      return true;
   }
}

var hcluster = function(items, distance, linkage, threshold, snapshot, snapshotCallback) {
   distance = distance || "euclidean";
   linkage = linkage || "average";

   if (typeof distance == "string") {
     distance = distances[distance];
   }
   var clusters = (new HierarchicalClustering(distance, linkage, threshold))
                  .cluster(items, snapshot, snapshotCallback);
      
   if (threshold === undefined) {
      return clusters[0]; // all clustered into one
   }
   return clusters;
}

module.exports = hcluster;

},{"./distance":2}],4:[function(require,module,exports){
var distances = require("./distance");

function KMeans(centroids) {
   this.centroids = centroids || [];
}

KMeans.prototype.randomCentroids = function(points, k) {
   var centroids = points.slice(0); // copy
   centroids.sort(function() {
      return (Math.round(Math.random()) - 0.5);
   });
   return centroids.slice(0, k);
}

KMeans.prototype.classify = function(point, distance) {
   var min = Infinity,
       index = 0;

   distance = distance || "euclidean";
   if (typeof distance == "string") {
      distance = distances[distance];
   }

   for (var i = 0; i < this.centroids.length; i++) {
      var dist = distance(point, this.centroids[i]);
      if (dist < min) {
         min = dist;
         index = i;
      }
   }

   return index;
}

KMeans.prototype.cluster = function(points, k, distance, snapshotPeriod, snapshotCb) {
   k = k || Math.max(2, Math.ceil(Math.sqrt(points.length / 2)));

   distance = distance || "euclidean";
   if (typeof distance == "string") {
      distance = distances[distance];
   }

   this.centroids = this.randomCentroids(points, k);

   var assignment = new Array(points.length);
   var clusters = new Array(k);

   var iterations = 0;
   var movement = true;
   while (movement) {
      // update point-to-centroid assignments
      for (var i = 0; i < points.length; i++) {
         assignment[i] = this.classify(points[i], distance);
      }

      // update location of each centroid
      movement = false;
      for (var j = 0; j < k; j++) {
         var assigned = [];
         for (var i = 0; i < assignment.length; i++) {
            if (assignment[i] == j) {
               assigned.push(points[i]);
            }
         }

         if (!assigned.length) {
            continue;
         }

         var centroid = this.centroids[j];
         var newCentroid = new Array(centroid.length);

         for (var g = 0; g < centroid.length; g++) {
            var sum = 0;
            for (var i = 0; i < assigned.length; i++) {
               sum += assigned[i][g];
            }
            newCentroid[g] = sum / assigned.length;

            if (newCentroid[g] != centroid[g]) {
               movement = true;
            }
         }

         this.centroids[j] = newCentroid;
         clusters[j] = assigned;
      }

      if (snapshotCb && (iterations++ % snapshotPeriod == 0)) {
         snapshotCb(clusters);
      }
   }

   return clusters;
}

KMeans.prototype.toJSON = function() {
   return JSON.stringify(this.centroids);
}

KMeans.prototype.fromJSON = function(json) {
   this.centroids = JSON.parse(json);
   return this;
}

module.exports = KMeans;

module.exports.kmeans = function(vectors, k) {
   return (new KMeans()).cluster(vectors, k);
}
},{"./distance":2}],5:[function(require,module,exports){
module.exports = require('./vendor/dat.gui')
module.exports.color = require('./vendor/dat.color')
},{"./vendor/dat.color":6,"./vendor/dat.gui":7}],6:[function(require,module,exports){
/**
 * dat-gui JavaScript Controller Library
 * http://code.google.com/p/dat-gui
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/** @namespace */
var dat = module.exports = dat || {};

/** @namespace */
dat.color = dat.color || {};

/** @namespace */
dat.utils = dat.utils || {};

dat.utils.common = (function () {
  
  var ARR_EACH = Array.prototype.forEach;
  var ARR_SLICE = Array.prototype.slice;

  /**
   * Band-aid methods for things that should be a lot easier in JavaScript.
   * Implementation and structure inspired by underscore.js
   * http://documentcloud.github.com/underscore/
   */

  return { 
    
    BREAK: {},
  
    extend: function(target) {
      
      this.each(ARR_SLICE.call(arguments, 1), function(obj) {
        
        for (var key in obj)
          if (!this.isUndefined(obj[key])) 
            target[key] = obj[key];
        
      }, this);
      
      return target;
      
    },
    
    defaults: function(target) {
      
      this.each(ARR_SLICE.call(arguments, 1), function(obj) {
        
        for (var key in obj)
          if (this.isUndefined(target[key])) 
            target[key] = obj[key];
        
      }, this);
      
      return target;
    
    },
    
    compose: function() {
      var toCall = ARR_SLICE.call(arguments);
            return function() {
              var args = ARR_SLICE.call(arguments);
              for (var i = toCall.length -1; i >= 0; i--) {
                args = [toCall[i].apply(this, args)];
              }
              return args[0];
            }
    },
    
    each: function(obj, itr, scope) {

      
      if (ARR_EACH && obj.forEach === ARR_EACH) { 
        
        obj.forEach(itr, scope);
        
      } else if (obj.length === obj.length + 0) { // Is number but not NaN
        
        for (var key = 0, l = obj.length; key < l; key++)
          if (key in obj && itr.call(scope, obj[key], key) === this.BREAK) 
            return;
            
      } else {

        for (var key in obj) 
          if (itr.call(scope, obj[key], key) === this.BREAK)
            return;
            
      }
            
    },
    
    defer: function(fnc) {
      setTimeout(fnc, 0);
    },
    
    toArray: function(obj) {
      if (obj.toArray) return obj.toArray();
      return ARR_SLICE.call(obj);
    },

    isUndefined: function(obj) {
      return obj === undefined;
    },
    
    isNull: function(obj) {
      return obj === null;
    },
    
    isNaN: function(obj) {
      return obj !== obj;
    },
    
    isArray: Array.isArray || function(obj) {
      return obj.constructor === Array;
    },
    
    isObject: function(obj) {
      return obj === Object(obj);
    },
    
    isNumber: function(obj) {
      return obj === obj+0;
    },
    
    isString: function(obj) {
      return obj === obj+'';
    },
    
    isBoolean: function(obj) {
      return obj === false || obj === true;
    },
    
    isFunction: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Function]';
    }
  
  };
    
})();


dat.color.toString = (function (common) {

  return function(color) {

    if (color.a == 1 || common.isUndefined(color.a)) {

      var s = color.hex.toString(16);
      while (s.length < 6) {
        s = '0' + s;
      }

      return '#' + s;

    } else {

      return 'rgba(' + Math.round(color.r) + ',' + Math.round(color.g) + ',' + Math.round(color.b) + ',' + color.a + ')';

    }

  }

})(dat.utils.common);


dat.Color = dat.color.Color = (function (interpret, math, toString, common) {

  var Color = function() {

    this.__state = interpret.apply(this, arguments);

    if (this.__state === false) {
      throw 'Failed to interpret color arguments';
    }

    this.__state.a = this.__state.a || 1;


  };

  Color.COMPONENTS = ['r','g','b','h','s','v','hex','a'];

  common.extend(Color.prototype, {

    toString: function() {
      return toString(this);
    },

    toOriginal: function() {
      return this.__state.conversion.write(this);
    }

  });

  defineRGBComponent(Color.prototype, 'r', 2);
  defineRGBComponent(Color.prototype, 'g', 1);
  defineRGBComponent(Color.prototype, 'b', 0);

  defineHSVComponent(Color.prototype, 'h');
  defineHSVComponent(Color.prototype, 's');
  defineHSVComponent(Color.prototype, 'v');

  Object.defineProperty(Color.prototype, 'a', {

    get: function() {
      return this.__state.a;
    },

    set: function(v) {
      this.__state.a = v;
    }

  });

  Object.defineProperty(Color.prototype, 'hex', {

    get: function() {

      if (!this.__state.space !== 'HEX') {
        this.__state.hex = math.rgb_to_hex(this.r, this.g, this.b);
      }

      return this.__state.hex;

    },

    set: function(v) {

      this.__state.space = 'HEX';
      this.__state.hex = v;

    }

  });

  function defineRGBComponent(target, component, componentHexIndex) {

    Object.defineProperty(target, component, {

      get: function() {

        if (this.__state.space === 'RGB') {
          return this.__state[component];
        }

        recalculateRGB(this, component, componentHexIndex);

        return this.__state[component];

      },

      set: function(v) {

        if (this.__state.space !== 'RGB') {
          recalculateRGB(this, component, componentHexIndex);
          this.__state.space = 'RGB';
        }

        this.__state[component] = v;

      }

    });

  }

  function defineHSVComponent(target, component) {

    Object.defineProperty(target, component, {

      get: function() {

        if (this.__state.space === 'HSV')
          return this.__state[component];

        recalculateHSV(this);

        return this.__state[component];

      },

      set: function(v) {

        if (this.__state.space !== 'HSV') {
          recalculateHSV(this);
          this.__state.space = 'HSV';
        }

        this.__state[component] = v;

      }

    });

  }

  function recalculateRGB(color, component, componentHexIndex) {

    if (color.__state.space === 'HEX') {

      color.__state[component] = math.component_from_hex(color.__state.hex, componentHexIndex);

    } else if (color.__state.space === 'HSV') {

      common.extend(color.__state, math.hsv_to_rgb(color.__state.h, color.__state.s, color.__state.v));

    } else {

      throw 'Corrupted color state';

    }

  }

  function recalculateHSV(color) {

    var result = math.rgb_to_hsv(color.r, color.g, color.b);

    common.extend(color.__state,
        {
          s: result.s,
          v: result.v
        }
    );

    if (!common.isNaN(result.h)) {
      color.__state.h = result.h;
    } else if (common.isUndefined(color.__state.h)) {
      color.__state.h = 0;
    }

  }

  return Color;

})(dat.color.interpret = (function (toString, common) {

  var result, toReturn;

  var interpret = function() {

    toReturn = false;

    var original = arguments.length > 1 ? common.toArray(arguments) : arguments[0];

    common.each(INTERPRETATIONS, function(family) {

      if (family.litmus(original)) {

        common.each(family.conversions, function(conversion, conversionName) {

          result = conversion.read(original);

          if (toReturn === false && result !== false) {
            toReturn = result;
            result.conversionName = conversionName;
            result.conversion = conversion;
            return common.BREAK;

          }

        });

        return common.BREAK;

      }

    });

    return toReturn;

  };

  var INTERPRETATIONS = [

    // Strings
    {

      litmus: common.isString,

      conversions: {

        THREE_CHAR_HEX: {

          read: function(original) {

            var test = original.match(/^#([A-F0-9])([A-F0-9])([A-F0-9])$/i);
            if (test === null) return false;

            return {
              space: 'HEX',
              hex: parseInt(
                  '0x' +
                      test[1].toString() + test[1].toString() +
                      test[2].toString() + test[2].toString() +
                      test[3].toString() + test[3].toString())
            };

          },

          write: toString

        },

        SIX_CHAR_HEX: {

          read: function(original) {

            var test = original.match(/^#([A-F0-9]{6})$/i);
            if (test === null) return false;

            return {
              space: 'HEX',
              hex: parseInt('0x' + test[1].toString())
            };

          },

          write: toString

        },

        CSS_RGB: {

          read: function(original) {

            var test = original.match(/^rgb\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\)/);
            if (test === null) return false;

            return {
              space: 'RGB',
              r: parseFloat(test[1]),
              g: parseFloat(test[2]),
              b: parseFloat(test[3])
            };

          },

          write: toString

        },

        CSS_RGBA: {

          read: function(original) {

            var test = original.match(/^rgba\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\,\s*(.+)\s*\)/);
            if (test === null) return false;

            return {
              space: 'RGB',
              r: parseFloat(test[1]),
              g: parseFloat(test[2]),
              b: parseFloat(test[3]),
              a: parseFloat(test[4])
            };

          },

          write: toString

        }

      }

    },

    // Numbers
    {

      litmus: common.isNumber,

      conversions: {

        HEX: {
          read: function(original) {
            return {
              space: 'HEX',
              hex: original,
              conversionName: 'HEX'
            }
          },

          write: function(color) {
            return color.hex;
          }
        }

      }

    },

    // Arrays
    {

      litmus: common.isArray,

      conversions: {

        RGB_ARRAY: {
          read: function(original) {
            if (original.length != 3) return false;
            return {
              space: 'RGB',
              r: original[0],
              g: original[1],
              b: original[2]
            };
          },

          write: function(color) {
            return [color.r, color.g, color.b];
          }

        },

        RGBA_ARRAY: {
          read: function(original) {
            if (original.length != 4) return false;
            return {
              space: 'RGB',
              r: original[0],
              g: original[1],
              b: original[2],
              a: original[3]
            };
          },

          write: function(color) {
            return [color.r, color.g, color.b, color.a];
          }

        }

      }

    },

    // Objects
    {

      litmus: common.isObject,

      conversions: {

        RGBA_OBJ: {
          read: function(original) {
            if (common.isNumber(original.r) &&
                common.isNumber(original.g) &&
                common.isNumber(original.b) &&
                common.isNumber(original.a)) {
              return {
                space: 'RGB',
                r: original.r,
                g: original.g,
                b: original.b,
                a: original.a
              }
            }
            return false;
          },

          write: function(color) {
            return {
              r: color.r,
              g: color.g,
              b: color.b,
              a: color.a
            }
          }
        },

        RGB_OBJ: {
          read: function(original) {
            if (common.isNumber(original.r) &&
                common.isNumber(original.g) &&
                common.isNumber(original.b)) {
              return {
                space: 'RGB',
                r: original.r,
                g: original.g,
                b: original.b
              }
            }
            return false;
          },

          write: function(color) {
            return {
              r: color.r,
              g: color.g,
              b: color.b
            }
          }
        },

        HSVA_OBJ: {
          read: function(original) {
            if (common.isNumber(original.h) &&
                common.isNumber(original.s) &&
                common.isNumber(original.v) &&
                common.isNumber(original.a)) {
              return {
                space: 'HSV',
                h: original.h,
                s: original.s,
                v: original.v,
                a: original.a
              }
            }
            return false;
          },

          write: function(color) {
            return {
              h: color.h,
              s: color.s,
              v: color.v,
              a: color.a
            }
          }
        },

        HSV_OBJ: {
          read: function(original) {
            if (common.isNumber(original.h) &&
                common.isNumber(original.s) &&
                common.isNumber(original.v)) {
              return {
                space: 'HSV',
                h: original.h,
                s: original.s,
                v: original.v
              }
            }
            return false;
          },

          write: function(color) {
            return {
              h: color.h,
              s: color.s,
              v: color.v
            }
          }

        }

      }

    }


  ];

  return interpret;


})(dat.color.toString,
dat.utils.common),
dat.color.math = (function () {

  var tmpComponent;

  return {

    hsv_to_rgb: function(h, s, v) {

      var hi = Math.floor(h / 60) % 6;

      var f = h / 60 - Math.floor(h / 60);
      var p = v * (1.0 - s);
      var q = v * (1.0 - (f * s));
      var t = v * (1.0 - ((1.0 - f) * s));
      var c = [
        [v, t, p],
        [q, v, p],
        [p, v, t],
        [p, q, v],
        [t, p, v],
        [v, p, q]
      ][hi];

      return {
        r: c[0] * 255,
        g: c[1] * 255,
        b: c[2] * 255
      };

    },

    rgb_to_hsv: function(r, g, b) {

      var min = Math.min(r, g, b),
          max = Math.max(r, g, b),
          delta = max - min,
          h, s;

      if (max != 0) {
        s = delta / max;
      } else {
        return {
          h: NaN,
          s: 0,
          v: 0
        };
      }

      if (r == max) {
        h = (g - b) / delta;
      } else if (g == max) {
        h = 2 + (b - r) / delta;
      } else {
        h = 4 + (r - g) / delta;
      }
      h /= 6;
      if (h < 0) {
        h += 1;
      }

      return {
        h: h * 360,
        s: s,
        v: max / 255
      };
    },

    rgb_to_hex: function(r, g, b) {
      var hex = this.hex_with_component(0, 2, r);
      hex = this.hex_with_component(hex, 1, g);
      hex = this.hex_with_component(hex, 0, b);
      return hex;
    },

    component_from_hex: function(hex, componentIndex) {
      return (hex >> (componentIndex * 8)) & 0xFF;
    },

    hex_with_component: function(hex, componentIndex, value) {
      return value << (tmpComponent = componentIndex * 8) | (hex & ~ (0xFF << tmpComponent));
    }

  }

})(),
dat.color.toString,
dat.utils.common);
},{}],7:[function(require,module,exports){
/**
 * dat-gui JavaScript Controller Library
 * http://code.google.com/p/dat-gui
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/** @namespace */
var dat = module.exports = dat || {};

/** @namespace */
dat.gui = dat.gui || {};

/** @namespace */
dat.utils = dat.utils || {};

/** @namespace */
dat.controllers = dat.controllers || {};

/** @namespace */
dat.dom = dat.dom || {};

/** @namespace */
dat.color = dat.color || {};

dat.utils.css = (function () {
  return {
    load: function (url, doc) {
      doc = doc || document;
      var link = doc.createElement('link');
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.href = url;
      doc.getElementsByTagName('head')[0].appendChild(link);
    },
    inject: function(css, doc) {
      doc = doc || document;
      var injected = document.createElement('style');
      injected.type = 'text/css';
      injected.innerHTML = css;
      doc.getElementsByTagName('head')[0].appendChild(injected);
    }
  }
})();


dat.utils.common = (function () {
  
  var ARR_EACH = Array.prototype.forEach;
  var ARR_SLICE = Array.prototype.slice;

  /**
   * Band-aid methods for things that should be a lot easier in JavaScript.
   * Implementation and structure inspired by underscore.js
   * http://documentcloud.github.com/underscore/
   */

  return { 
    
    BREAK: {},
  
    extend: function(target) {
      
      this.each(ARR_SLICE.call(arguments, 1), function(obj) {
        
        for (var key in obj)
          if (!this.isUndefined(obj[key])) 
            target[key] = obj[key];
        
      }, this);
      
      return target;
      
    },
    
    defaults: function(target) {
      
      this.each(ARR_SLICE.call(arguments, 1), function(obj) {
        
        for (var key in obj)
          if (this.isUndefined(target[key])) 
            target[key] = obj[key];
        
      }, this);
      
      return target;
    
    },
    
    compose: function() {
      var toCall = ARR_SLICE.call(arguments);
            return function() {
              var args = ARR_SLICE.call(arguments);
              for (var i = toCall.length -1; i >= 0; i--) {
                args = [toCall[i].apply(this, args)];
              }
              return args[0];
            }
    },
    
    each: function(obj, itr, scope) {

      
      if (ARR_EACH && obj.forEach === ARR_EACH) { 
        
        obj.forEach(itr, scope);
        
      } else if (obj.length === obj.length + 0) { // Is number but not NaN
        
        for (var key = 0, l = obj.length; key < l; key++)
          if (key in obj && itr.call(scope, obj[key], key) === this.BREAK) 
            return;
            
      } else {

        for (var key in obj) 
          if (itr.call(scope, obj[key], key) === this.BREAK)
            return;
            
      }
            
    },
    
    defer: function(fnc) {
      setTimeout(fnc, 0);
    },
    
    toArray: function(obj) {
      if (obj.toArray) return obj.toArray();
      return ARR_SLICE.call(obj);
    },

    isUndefined: function(obj) {
      return obj === undefined;
    },
    
    isNull: function(obj) {
      return obj === null;
    },
    
    isNaN: function(obj) {
      return obj !== obj;
    },
    
    isArray: Array.isArray || function(obj) {
      return obj.constructor === Array;
    },
    
    isObject: function(obj) {
      return obj === Object(obj);
    },
    
    isNumber: function(obj) {
      return obj === obj+0;
    },
    
    isString: function(obj) {
      return obj === obj+'';
    },
    
    isBoolean: function(obj) {
      return obj === false || obj === true;
    },
    
    isFunction: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Function]';
    }
  
  };
    
})();


dat.controllers.Controller = (function (common) {

  /**
   * @class An "abstract" class that represents a given property of an object.
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   *
   * @member dat.controllers
   */
  var Controller = function(object, property) {

    this.initialValue = object[property];

    /**
     * Those who extend this class will put their DOM elements in here.
     * @type {DOMElement}
     */
    this.domElement = document.createElement('div');

    /**
     * The object to manipulate
     * @type {Object}
     */
    this.object = object;

    /**
     * The name of the property to manipulate
     * @type {String}
     */
    this.property = property;

    /**
     * The function to be called on change.
     * @type {Function}
     * @ignore
     */
    this.__onChange = undefined;

    /**
     * The function to be called on finishing change.
     * @type {Function}
     * @ignore
     */
    this.__onFinishChange = undefined;

  };

  common.extend(

      Controller.prototype,

      /** @lends dat.controllers.Controller.prototype */
      {

        /**
         * Specify that a function fire every time someone changes the value with
         * this Controller.
         *
         * @param {Function} fnc This function will be called whenever the value
         * is modified via this Controller.
         * @returns {dat.controllers.Controller} this
         */
        onChange: function(fnc) {
          this.__onChange = fnc;
          return this;
        },

        /**
         * Specify that a function fire every time someone "finishes" changing
         * the value wih this Controller. Useful for values that change
         * incrementally like numbers or strings.
         *
         * @param {Function} fnc This function will be called whenever
         * someone "finishes" changing the value via this Controller.
         * @returns {dat.controllers.Controller} this
         */
        onFinishChange: function(fnc) {
          this.__onFinishChange = fnc;
          return this;
        },

        /**
         * Change the value of <code>object[property]</code>
         *
         * @param {Object} newValue The new value of <code>object[property]</code>
         */
        setValue: function(newValue) {
          this.object[this.property] = newValue;
          if (this.__onChange) {
            this.__onChange.call(this, newValue);
          }
          this.updateDisplay();
          return this;
        },

        /**
         * Gets the value of <code>object[property]</code>
         *
         * @returns {Object} The current value of <code>object[property]</code>
         */
        getValue: function() {
          return this.object[this.property];
        },

        /**
         * Refreshes the visual display of a Controller in order to keep sync
         * with the object's current value.
         * @returns {dat.controllers.Controller} this
         */
        updateDisplay: function() {
          return this;
        },

        /**
         * @returns {Boolean} true if the value has deviated from initialValue
         */
        isModified: function() {
          return this.initialValue !== this.getValue()
        }

      }

  );

  return Controller;


})(dat.utils.common);


dat.dom.dom = (function (common) {

  var EVENT_MAP = {
    'HTMLEvents': ['change'],
    'MouseEvents': ['click','mousemove','mousedown','mouseup', 'mouseover'],
    'KeyboardEvents': ['keydown']
  };

  var EVENT_MAP_INV = {};
  common.each(EVENT_MAP, function(v, k) {
    common.each(v, function(e) {
      EVENT_MAP_INV[e] = k;
    });
  });

  var CSS_VALUE_PIXELS = /(\d+(\.\d+)?)px/;

  function cssValueToPixels(val) {

    if (val === '0' || common.isUndefined(val)) return 0;

    var match = val.match(CSS_VALUE_PIXELS);

    if (!common.isNull(match)) {
      return parseFloat(match[1]);
    }

    // TODO ...ems? %?

    return 0;

  }

  /**
   * @namespace
   * @member dat.dom
   */
  var dom = {

    /**
     * 
     * @param elem
     * @param selectable
     */
    makeSelectable: function(elem, selectable) {

      if (elem === undefined || elem.style === undefined) return;

      elem.onselectstart = selectable ? function() {
        return false;
      } : function() {
      };

      elem.style.MozUserSelect = selectable ? 'auto' : 'none';
      elem.style.KhtmlUserSelect = selectable ? 'auto' : 'none';
      elem.unselectable = selectable ? 'on' : 'off';

    },

    /**
     *
     * @param elem
     * @param horizontal
     * @param vertical
     */
    makeFullscreen: function(elem, horizontal, vertical) {

      if (common.isUndefined(horizontal)) horizontal = true;
      if (common.isUndefined(vertical)) vertical = true;

      elem.style.position = 'absolute';

      if (horizontal) {
        elem.style.left = 0;
        elem.style.right = 0;
      }
      if (vertical) {
        elem.style.top = 0;
        elem.style.bottom = 0;
      }

    },

    /**
     *
     * @param elem
     * @param eventType
     * @param params
     */
    fakeEvent: function(elem, eventType, params, aux) {
      params = params || {};
      var className = EVENT_MAP_INV[eventType];
      if (!className) {
        throw new Error('Event type ' + eventType + ' not supported.');
      }
      var evt = document.createEvent(className);
      switch (className) {
        case 'MouseEvents':
          var clientX = params.x || params.clientX || 0;
          var clientY = params.y || params.clientY || 0;
          evt.initMouseEvent(eventType, params.bubbles || false,
              params.cancelable || true, window, params.clickCount || 1,
              0, //screen X
              0, //screen Y
              clientX, //client X
              clientY, //client Y
              false, false, false, false, 0, null);
          break;
        case 'KeyboardEvents':
          var init = evt.initKeyboardEvent || evt.initKeyEvent; // webkit || moz
          common.defaults(params, {
            cancelable: true,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            keyCode: undefined,
            charCode: undefined
          });
          init(eventType, params.bubbles || false,
              params.cancelable, window,
              params.ctrlKey, params.altKey,
              params.shiftKey, params.metaKey,
              params.keyCode, params.charCode);
          break;
        default:
          evt.initEvent(eventType, params.bubbles || false,
              params.cancelable || true);
          break;
      }
      common.defaults(evt, aux);
      elem.dispatchEvent(evt);
    },

    /**
     *
     * @param elem
     * @param event
     * @param func
     * @param bool
     */
    bind: function(elem, event, func, bool) {
      bool = bool || false;
      if (elem.addEventListener)
        elem.addEventListener(event, func, bool);
      else if (elem.attachEvent)
        elem.attachEvent('on' + event, func);
      return dom;
    },

    /**
     *
     * @param elem
     * @param event
     * @param func
     * @param bool
     */
    unbind: function(elem, event, func, bool) {
      bool = bool || false;
      if (elem.removeEventListener)
        elem.removeEventListener(event, func, bool);
      else if (elem.detachEvent)
        elem.detachEvent('on' + event, func);
      return dom;
    },

    /**
     *
     * @param elem
     * @param className
     */
    addClass: function(elem, className) {
      if (elem.className === undefined) {
        elem.className = className;
      } else if (elem.className !== className) {
        var classes = elem.className.split(/ +/);
        if (classes.indexOf(className) == -1) {
          classes.push(className);
          elem.className = classes.join(' ').replace(/^\s+/, '').replace(/\s+$/, '');
        }
      }
      return dom;
    },

    /**
     *
     * @param elem
     * @param className
     */
    removeClass: function(elem, className) {
      if (className) {
        if (elem.className === undefined) {
          // elem.className = className;
        } else if (elem.className === className) {
          elem.removeAttribute('class');
        } else {
          var classes = elem.className.split(/ +/);
          var index = classes.indexOf(className);
          if (index != -1) {
            classes.splice(index, 1);
            elem.className = classes.join(' ');
          }
        }
      } else {
        elem.className = undefined;
      }
      return dom;
    },

    hasClass: function(elem, className) {
      return new RegExp('(?:^|\\s+)' + className + '(?:\\s+|$)').test(elem.className) || false;
    },

    /**
     *
     * @param elem
     */
    getWidth: function(elem) {

      var style = getComputedStyle(elem);

      return cssValueToPixels(style['border-left-width']) +
          cssValueToPixels(style['border-right-width']) +
          cssValueToPixels(style['padding-left']) +
          cssValueToPixels(style['padding-right']) +
          cssValueToPixels(style['width']);
    },

    /**
     *
     * @param elem
     */
    getHeight: function(elem) {

      var style = getComputedStyle(elem);

      return cssValueToPixels(style['border-top-width']) +
          cssValueToPixels(style['border-bottom-width']) +
          cssValueToPixels(style['padding-top']) +
          cssValueToPixels(style['padding-bottom']) +
          cssValueToPixels(style['height']);
    },

    /**
     *
     * @param elem
     */
    getOffset: function(elem) {
      var offset = {left: 0, top:0};
      if (elem.offsetParent) {
        do {
          offset.left += elem.offsetLeft;
          offset.top += elem.offsetTop;
        } while (elem = elem.offsetParent);
      }
      return offset;
    },

    // http://stackoverflow.com/posts/2684561/revisions
    /**
     * 
     * @param elem
     */
    isActive: function(elem) {
      return elem === document.activeElement && ( elem.type || elem.href );
    }

  };

  return dom;

})(dat.utils.common);


dat.controllers.OptionController = (function (Controller, dom, common) {

  /**
   * @class Provides a select input to alter the property of an object, using a
   * list of accepted values.
   *
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   * @param {Object|string[]} options A map of labels to acceptable values, or
   * a list of acceptable string values.
   *
   * @member dat.controllers
   */
  var OptionController = function(object, property, options) {

    OptionController.superclass.call(this, object, property);

    var _this = this;

    /**
     * The drop down menu
     * @ignore
     */
    this.__select = document.createElement('select');

    if (common.isArray(options)) {
      var map = {};
      common.each(options, function(element) {
        map[element] = element;
      });
      options = map;
    }

    common.each(options, function(value, key) {

      var opt = document.createElement('option');
      opt.innerHTML = key;
      opt.setAttribute('value', value);
      _this.__select.appendChild(opt);

    });

    // Acknowledge original value
    this.updateDisplay();

    dom.bind(this.__select, 'change', function() {
      var desiredValue = this.options[this.selectedIndex].value;
      _this.setValue(desiredValue);
    });

    this.domElement.appendChild(this.__select);

  };

  OptionController.superclass = Controller;

  common.extend(

      OptionController.prototype,
      Controller.prototype,

      {

        setValue: function(v) {
          var toReturn = OptionController.superclass.prototype.setValue.call(this, v);
          if (this.__onFinishChange) {
            this.__onFinishChange.call(this, this.getValue());
          }
          return toReturn;
        },

        updateDisplay: function() {
          this.__select.value = this.getValue();
          return OptionController.superclass.prototype.updateDisplay.call(this);
        }

      }

  );

  return OptionController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.utils.common);


dat.controllers.NumberController = (function (Controller, common) {

  /**
   * @class Represents a given property of an object that is a number.
   *
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   * @param {Object} [params] Optional parameters
   * @param {Number} [params.min] Minimum allowed value
   * @param {Number} [params.max] Maximum allowed value
   * @param {Number} [params.step] Increment by which to change value
   *
   * @member dat.controllers
   */
  var NumberController = function(object, property, params) {

    NumberController.superclass.call(this, object, property);

    params = params || {};

    this.__min = params.min;
    this.__max = params.max;
    this.__step = params.step;

    if (common.isUndefined(this.__step)) {

      if (this.initialValue == 0) {
        this.__impliedStep = 1; // What are we, psychics?
      } else {
        // Hey Doug, check this out.
        this.__impliedStep = Math.pow(10, Math.floor(Math.log(this.initialValue)/Math.LN10))/10;
      }

    } else {

      this.__impliedStep = this.__step;

    }

    this.__precision = numDecimals(this.__impliedStep);


  };

  NumberController.superclass = Controller;

  common.extend(

      NumberController.prototype,
      Controller.prototype,

      /** @lends dat.controllers.NumberController.prototype */
      {

        setValue: function(v) {

          if (this.__min !== undefined && v < this.__min) {
            v = this.__min;
          } else if (this.__max !== undefined && v > this.__max) {
            v = this.__max;
          }

          if (this.__step !== undefined && v % this.__step != 0) {
            v = Math.round(v / this.__step) * this.__step;
          }

          return NumberController.superclass.prototype.setValue.call(this, v);

        },

        /**
         * Specify a minimum value for <code>object[property]</code>.
         *
         * @param {Number} minValue The minimum value for
         * <code>object[property]</code>
         * @returns {dat.controllers.NumberController} this
         */
        min: function(v) {
          this.__min = v;
          return this;
        },

        /**
         * Specify a maximum value for <code>object[property]</code>.
         *
         * @param {Number} maxValue The maximum value for
         * <code>object[property]</code>
         * @returns {dat.controllers.NumberController} this
         */
        max: function(v) {
          this.__max = v;
          return this;
        },

        /**
         * Specify a step value that dat.controllers.NumberController
         * increments by.
         *
         * @param {Number} stepValue The step value for
         * dat.controllers.NumberController
         * @default if minimum and maximum specified increment is 1% of the
         * difference otherwise stepValue is 1
         * @returns {dat.controllers.NumberController} this
         */
        step: function(v) {
          this.__step = v;
          return this;
        }

      }

  );

  function numDecimals(x) {
    x = x.toString();
    if (x.indexOf('.') > -1) {
      return x.length - x.indexOf('.') - 1;
    } else {
      return 0;
    }
  }

  return NumberController;

})(dat.controllers.Controller,
dat.utils.common);


dat.controllers.NumberControllerBox = (function (NumberController, dom, common) {

  /**
   * @class Represents a given property of an object that is a number and
   * provides an input element with which to manipulate it.
   *
   * @extends dat.controllers.Controller
   * @extends dat.controllers.NumberController
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   * @param {Object} [params] Optional parameters
   * @param {Number} [params.min] Minimum allowed value
   * @param {Number} [params.max] Maximum allowed value
   * @param {Number} [params.step] Increment by which to change value
   *
   * @member dat.controllers
   */
  var NumberControllerBox = function(object, property, params) {

    this.__truncationSuspended = false;

    NumberControllerBox.superclass.call(this, object, property, params);

    var _this = this;

    /**
     * {Number} Previous mouse y position
     * @ignore
     */
    var prev_y;

    this.__input = document.createElement('input');
    this.__input.setAttribute('type', 'text');

    // Makes it so manually specified values are not truncated.

    dom.bind(this.__input, 'change', onChange);
    dom.bind(this.__input, 'blur', onBlur);
    dom.bind(this.__input, 'mousedown', onMouseDown);
    dom.bind(this.__input, 'keydown', function(e) {

      // When pressing entire, you can be as precise as you want.
      if (e.keyCode === 13) {
        _this.__truncationSuspended = true;
        this.blur();
        _this.__truncationSuspended = false;
      }

    });

    function onChange() {
      var attempted = parseFloat(_this.__input.value);
      if (!common.isNaN(attempted)) _this.setValue(attempted);
    }

    function onBlur() {
      onChange();
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }

    function onMouseDown(e) {
      dom.bind(window, 'mousemove', onMouseDrag);
      dom.bind(window, 'mouseup', onMouseUp);
      prev_y = e.clientY;
    }

    function onMouseDrag(e) {

      var diff = prev_y - e.clientY;
      _this.setValue(_this.getValue() + diff * _this.__impliedStep);

      prev_y = e.clientY;

    }

    function onMouseUp() {
      dom.unbind(window, 'mousemove', onMouseDrag);
      dom.unbind(window, 'mouseup', onMouseUp);
    }

    this.updateDisplay();

    this.domElement.appendChild(this.__input);

  };

  NumberControllerBox.superclass = NumberController;

  common.extend(

      NumberControllerBox.prototype,
      NumberController.prototype,

      {

        updateDisplay: function() {

          this.__input.value = this.__truncationSuspended ? this.getValue() : roundToDecimal(this.getValue(), this.__precision);
          return NumberControllerBox.superclass.prototype.updateDisplay.call(this);
        }

      }

  );

  function roundToDecimal(value, decimals) {
    var tenTo = Math.pow(10, decimals);
    return Math.round(value * tenTo) / tenTo;
  }

  return NumberControllerBox;

})(dat.controllers.NumberController,
dat.dom.dom,
dat.utils.common);


dat.controllers.NumberControllerSlider = (function (NumberController, dom, css, common, styleSheet) {

  /**
   * @class Represents a given property of an object that is a number, contains
   * a minimum and maximum, and provides a slider element with which to
   * manipulate it. It should be noted that the slider element is made up of
   * <code>&lt;div&gt;</code> tags, <strong>not</strong> the html5
   * <code>&lt;slider&gt;</code> element.
   *
   * @extends dat.controllers.Controller
   * @extends dat.controllers.NumberController
   * 
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   * @param {Number} minValue Minimum allowed value
   * @param {Number} maxValue Maximum allowed value
   * @param {Number} stepValue Increment by which to change value
   *
   * @member dat.controllers
   */
  var NumberControllerSlider = function(object, property, min, max, step) {

    NumberControllerSlider.superclass.call(this, object, property, { min: min, max: max, step: step });

    var _this = this;

    this.__background = document.createElement('div');
    this.__foreground = document.createElement('div');
    


    dom.bind(this.__background, 'mousedown', onMouseDown);
    
    dom.addClass(this.__background, 'slider');
    dom.addClass(this.__foreground, 'slider-fg');

    function onMouseDown(e) {

      dom.bind(window, 'mousemove', onMouseDrag);
      dom.bind(window, 'mouseup', onMouseUp);

      onMouseDrag(e);
    }

    function onMouseDrag(e) {

      e.preventDefault();

      var offset = dom.getOffset(_this.__background);
      var width = dom.getWidth(_this.__background);
      
      _this.setValue(
        map(e.clientX, offset.left, offset.left + width, _this.__min, _this.__max)
      );

      return false;

    }

    function onMouseUp() {
      dom.unbind(window, 'mousemove', onMouseDrag);
      dom.unbind(window, 'mouseup', onMouseUp);
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }

    this.updateDisplay();

    this.__background.appendChild(this.__foreground);
    this.domElement.appendChild(this.__background);

  };

  NumberControllerSlider.superclass = NumberController;

  /**
   * Injects default stylesheet for slider elements.
   */
  NumberControllerSlider.useDefaultStyles = function() {
    css.inject(styleSheet);
  };

  common.extend(

      NumberControllerSlider.prototype,
      NumberController.prototype,

      {

        updateDisplay: function() {
          var pct = (this.getValue() - this.__min)/(this.__max - this.__min);
          this.__foreground.style.width = pct*100+'%';
          return NumberControllerSlider.superclass.prototype.updateDisplay.call(this);
        }

      }



  );

  function map(v, i1, i2, o1, o2) {
    return o1 + (o2 - o1) * ((v - i1) / (i2 - i1));
  }

  return NumberControllerSlider;
  
})(dat.controllers.NumberController,
dat.dom.dom,
dat.utils.css,
dat.utils.common,
".slider {\n  box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);\n  height: 1em;\n  border-radius: 1em;\n  background-color: #eee;\n  padding: 0 0.5em;\n  overflow: hidden;\n}\n\n.slider-fg {\n  padding: 1px 0 2px 0;\n  background-color: #aaa;\n  height: 1em;\n  margin-left: -0.5em;\n  padding-right: 0.5em;\n  border-radius: 1em 0 0 1em;\n}\n\n.slider-fg:after {\n  display: inline-block;\n  border-radius: 1em;\n  background-color: #fff;\n  border:  1px solid #aaa;\n  content: '';\n  float: right;\n  margin-right: -1em;\n  margin-top: -1px;\n  height: 0.9em;\n  width: 0.9em;\n}");


dat.controllers.FunctionController = (function (Controller, dom, common) {

  /**
   * @class Provides a GUI interface to fire a specified method, a property of an object.
   *
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   *
   * @member dat.controllers
   */
  var FunctionController = function(object, property, text) {

    FunctionController.superclass.call(this, object, property);

    var _this = this;

    this.__button = document.createElement('div');
    this.__button.innerHTML = text === undefined ? 'Fire' : text;
    dom.bind(this.__button, 'click', function(e) {
      e.preventDefault();
      _this.fire();
      return false;
    });

    dom.addClass(this.__button, 'button');

    this.domElement.appendChild(this.__button);


  };

  FunctionController.superclass = Controller;

  common.extend(

      FunctionController.prototype,
      Controller.prototype,
      {
        
        fire: function() {
          if (this.__onChange) {
            this.__onChange.call(this);
          }
          if (this.__onFinishChange) {
            this.__onFinishChange.call(this, this.getValue());
          }
          this.getValue().call(this.object);
        }
      }

  );

  return FunctionController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.utils.common);


dat.controllers.BooleanController = (function (Controller, dom, common) {

  /**
   * @class Provides a checkbox input to alter the boolean property of an object.
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   *
   * @member dat.controllers
   */
  var BooleanController = function(object, property) {

    BooleanController.superclass.call(this, object, property);

    var _this = this;
    this.__prev = this.getValue();

    this.__checkbox = document.createElement('input');
    this.__checkbox.setAttribute('type', 'checkbox');


    dom.bind(this.__checkbox, 'change', onChange, false);

    this.domElement.appendChild(this.__checkbox);

    // Match original value
    this.updateDisplay();

    function onChange() {
      _this.setValue(!_this.__prev);
    }

  };

  BooleanController.superclass = Controller;

  common.extend(

      BooleanController.prototype,
      Controller.prototype,

      {

        setValue: function(v) {
          var toReturn = BooleanController.superclass.prototype.setValue.call(this, v);
          if (this.__onFinishChange) {
            this.__onFinishChange.call(this, this.getValue());
          }
          this.__prev = this.getValue();
          return toReturn;
        },

        updateDisplay: function() {
          
          if (this.getValue() === true) {
            this.__checkbox.setAttribute('checked', 'checked');
            this.__checkbox.checked = true;    
          } else {
              this.__checkbox.checked = false;
          }

          return BooleanController.superclass.prototype.updateDisplay.call(this);

        }


      }

  );

  return BooleanController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.utils.common);


dat.color.toString = (function (common) {

  return function(color) {

    if (color.a == 1 || common.isUndefined(color.a)) {

      var s = color.hex.toString(16);
      while (s.length < 6) {
        s = '0' + s;
      }

      return '#' + s;

    } else {

      return 'rgba(' + Math.round(color.r) + ',' + Math.round(color.g) + ',' + Math.round(color.b) + ',' + color.a + ')';

    }

  }

})(dat.utils.common);


dat.color.interpret = (function (toString, common) {

  var result, toReturn;

  var interpret = function() {

    toReturn = false;

    var original = arguments.length > 1 ? common.toArray(arguments) : arguments[0];

    common.each(INTERPRETATIONS, function(family) {

      if (family.litmus(original)) {

        common.each(family.conversions, function(conversion, conversionName) {

          result = conversion.read(original);

          if (toReturn === false && result !== false) {
            toReturn = result;
            result.conversionName = conversionName;
            result.conversion = conversion;
            return common.BREAK;

          }

        });

        return common.BREAK;

      }

    });

    return toReturn;

  };

  var INTERPRETATIONS = [

    // Strings
    {

      litmus: common.isString,

      conversions: {

        THREE_CHAR_HEX: {

          read: function(original) {

            var test = original.match(/^#([A-F0-9])([A-F0-9])([A-F0-9])$/i);
            if (test === null) return false;

            return {
              space: 'HEX',
              hex: parseInt(
                  '0x' +
                      test[1].toString() + test[1].toString() +
                      test[2].toString() + test[2].toString() +
                      test[3].toString() + test[3].toString())
            };

          },

          write: toString

        },

        SIX_CHAR_HEX: {

          read: function(original) {

            var test = original.match(/^#([A-F0-9]{6})$/i);
            if (test === null) return false;

            return {
              space: 'HEX',
              hex: parseInt('0x' + test[1].toString())
            };

          },

          write: toString

        },

        CSS_RGB: {

          read: function(original) {

            var test = original.match(/^rgb\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\)/);
            if (test === null) return false;

            return {
              space: 'RGB',
              r: parseFloat(test[1]),
              g: parseFloat(test[2]),
              b: parseFloat(test[3])
            };

          },

          write: toString

        },

        CSS_RGBA: {

          read: function(original) {

            var test = original.match(/^rgba\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\,\s*(.+)\s*\)/);
            if (test === null) return false;

            return {
              space: 'RGB',
              r: parseFloat(test[1]),
              g: parseFloat(test[2]),
              b: parseFloat(test[3]),
              a: parseFloat(test[4])
            };

          },

          write: toString

        }

      }

    },

    // Numbers
    {

      litmus: common.isNumber,

      conversions: {

        HEX: {
          read: function(original) {
            return {
              space: 'HEX',
              hex: original,
              conversionName: 'HEX'
            }
          },

          write: function(color) {
            return color.hex;
          }
        }

      }

    },

    // Arrays
    {

      litmus: common.isArray,

      conversions: {

        RGB_ARRAY: {
          read: function(original) {
            if (original.length != 3) return false;
            return {
              space: 'RGB',
              r: original[0],
              g: original[1],
              b: original[2]
            };
          },

          write: function(color) {
            return [color.r, color.g, color.b];
          }

        },

        RGBA_ARRAY: {
          read: function(original) {
            if (original.length != 4) return false;
            return {
              space: 'RGB',
              r: original[0],
              g: original[1],
              b: original[2],
              a: original[3]
            };
          },

          write: function(color) {
            return [color.r, color.g, color.b, color.a];
          }

        }

      }

    },

    // Objects
    {

      litmus: common.isObject,

      conversions: {

        RGBA_OBJ: {
          read: function(original) {
            if (common.isNumber(original.r) &&
                common.isNumber(original.g) &&
                common.isNumber(original.b) &&
                common.isNumber(original.a)) {
              return {
                space: 'RGB',
                r: original.r,
                g: original.g,
                b: original.b,
                a: original.a
              }
            }
            return false;
          },

          write: function(color) {
            return {
              r: color.r,
              g: color.g,
              b: color.b,
              a: color.a
            }
          }
        },

        RGB_OBJ: {
          read: function(original) {
            if (common.isNumber(original.r) &&
                common.isNumber(original.g) &&
                common.isNumber(original.b)) {
              return {
                space: 'RGB',
                r: original.r,
                g: original.g,
                b: original.b
              }
            }
            return false;
          },

          write: function(color) {
            return {
              r: color.r,
              g: color.g,
              b: color.b
            }
          }
        },

        HSVA_OBJ: {
          read: function(original) {
            if (common.isNumber(original.h) &&
                common.isNumber(original.s) &&
                common.isNumber(original.v) &&
                common.isNumber(original.a)) {
              return {
                space: 'HSV',
                h: original.h,
                s: original.s,
                v: original.v,
                a: original.a
              }
            }
            return false;
          },

          write: function(color) {
            return {
              h: color.h,
              s: color.s,
              v: color.v,
              a: color.a
            }
          }
        },

        HSV_OBJ: {
          read: function(original) {
            if (common.isNumber(original.h) &&
                common.isNumber(original.s) &&
                common.isNumber(original.v)) {
              return {
                space: 'HSV',
                h: original.h,
                s: original.s,
                v: original.v
              }
            }
            return false;
          },

          write: function(color) {
            return {
              h: color.h,
              s: color.s,
              v: color.v
            }
          }

        }

      }

    }


  ];

  return interpret;


})(dat.color.toString,
dat.utils.common);


dat.GUI = dat.gui.GUI = (function (css, saveDialogueContents, styleSheet, controllerFactory, Controller, BooleanController, FunctionController, NumberControllerBox, NumberControllerSlider, OptionController, ColorController, requestAnimationFrame, CenteredDiv, dom, common) {

  css.inject(styleSheet);

  /** Outer-most className for GUI's */
  var CSS_NAMESPACE = 'dg';

  var HIDE_KEY_CODE = 72;

  /** The only value shared between the JS and SCSS. Use caution. */
  var CLOSE_BUTTON_HEIGHT = 20;

  var DEFAULT_DEFAULT_PRESET_NAME = 'Default';

  var SUPPORTS_LOCAL_STORAGE = (function() {
    try {
      return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
      return false;
    }
  })();

  var SAVE_DIALOGUE;

  /** Have we yet to create an autoPlace GUI? */
  var auto_place_virgin = true;

  /** Fixed position div that auto place GUI's go inside */
  var auto_place_container;

  /** Are we hiding the GUI's ? */
  var hide = false;

  /** GUI's which should be hidden */
  var hideable_guis = [];

  /**
   * A lightweight controller library for JavaScript. It allows you to easily
   * manipulate variables and fire functions on the fly.
   * @class
   *
   * @member dat.gui
   *
   * @param {Object} [params]
   * @param {String} [params.name] The name of this GUI.
   * @param {Object} [params.load] JSON object representing the saved state of
   * this GUI.
   * @param {Boolean} [params.auto=true]
   * @param {dat.gui.GUI} [params.parent] The GUI I'm nested in.
   * @param {Boolean} [params.closed] If true, starts closed
   */
  var GUI = function(params) {

    var _this = this;

    /**
     * Outermost DOM Element
     * @type DOMElement
     */
    this.domElement = document.createElement('div');
    this.__ul = document.createElement('ul');
    this.domElement.appendChild(this.__ul);

    dom.addClass(this.domElement, CSS_NAMESPACE);

    /**
     * Nested GUI's by name
     * @ignore
     */
    this.__folders = {};

    this.__controllers = [];

    /**
     * List of objects I'm remembering for save, only used in top level GUI
     * @ignore
     */
    this.__rememberedObjects = [];

    /**
     * Maps the index of remembered objects to a map of controllers, only used
     * in top level GUI.
     *
     * @private
     * @ignore
     *
     * @example
     * [
     *  {
     *    propertyName: Controller,
     *    anotherPropertyName: Controller
     *  },
     *  {
     *    propertyName: Controller
     *  }
     * ]
     */
    this.__rememberedObjectIndecesToControllers = [];

    this.__listening = [];

    params = params || {};

    // Default parameters
    params = common.defaults(params, {
      autoPlace: true,
      width: GUI.DEFAULT_WIDTH
    });

    params = common.defaults(params, {
      resizable: params.autoPlace,
      hideable: params.autoPlace
    });


    if (!common.isUndefined(params.load)) {

      // Explicit preset
      if (params.preset) params.load.preset = params.preset;

    } else {

      params.load = { preset: DEFAULT_DEFAULT_PRESET_NAME };

    }

    if (common.isUndefined(params.parent) && params.hideable) {
      hideable_guis.push(this);
    }

    // Only root level GUI's are resizable.
    params.resizable = common.isUndefined(params.parent) && params.resizable;


    if (params.autoPlace && common.isUndefined(params.scrollable)) {
      params.scrollable = true;
    }
//    params.scrollable = common.isUndefined(params.parent) && params.scrollable === true;

    // Not part of params because I don't want people passing this in via
    // constructor. Should be a 'remembered' value.
    var use_local_storage =
        SUPPORTS_LOCAL_STORAGE &&
            localStorage.getItem(getLocalStorageHash(this, 'isLocal')) === 'true';

    Object.defineProperties(this,

        /** @lends dat.gui.GUI.prototype */
        {

          /**
           * The parent <code>GUI</code>
           * @type dat.gui.GUI
           */
          parent: {
            get: function() {
              return params.parent;
            }
          },

          scrollable: {
            get: function() {
              return params.scrollable;
            }
          },

          /**
           * Handles <code>GUI</code>'s element placement for you
           * @type Boolean
           */
          autoPlace: {
            get: function() {
              return params.autoPlace;
            }
          },

          /**
           * The identifier for a set of saved values
           * @type String
           */
          preset: {

            get: function() {
              if (_this.parent) {
                return _this.getRoot().preset;
              } else {
                return params.load.preset;
              }
            },

            set: function(v) {
              if (_this.parent) {
                _this.getRoot().preset = v;
              } else {
                params.load.preset = v;
              }
              setPresetSelectIndex(this);
              _this.revert();
            }

          },

          /**
           * The width of <code>GUI</code> element
           * @type Number
           */
          width: {
            get: function() {
              return params.width;
            },
            set: function(v) {
              params.width = v;
              setWidth(_this, v);
            }
          },

          /**
           * The name of <code>GUI</code>. Used for folders. i.e
           * a folder's name
           * @type String
           */
          name: {
            get: function() {
              return params.name;
            },
            set: function(v) {
              // TODO Check for collisions among sibling folders
              params.name = v;
              if (title_row_name) {
                title_row_name.innerHTML = params.name;
              }
            }
          },

          /**
           * Whether the <code>GUI</code> is collapsed or not
           * @type Boolean
           */
          closed: {
            get: function() {
              return params.closed;
            },
            set: function(v) {
              params.closed = v;
              if (params.closed) {
                dom.addClass(_this.__ul, GUI.CLASS_CLOSED);
              } else {
                dom.removeClass(_this.__ul, GUI.CLASS_CLOSED);
              }
              // For browsers that aren't going to respect the CSS transition,
              // Lets just check our height against the window height right off
              // the bat.
              this.onResize();

              if (_this.__closeButton) {
                _this.__closeButton.innerHTML = v ? GUI.TEXT_OPEN : GUI.TEXT_CLOSED;
              }
            }
          },

          /**
           * Contains all presets
           * @type Object
           */
          load: {
            get: function() {
              return params.load;
            }
          },

          /**
           * Determines whether or not to use <a href="https://developer.mozilla.org/en/DOM/Storage#localStorage">localStorage</a> as the means for
           * <code>remember</code>ing
           * @type Boolean
           */
          useLocalStorage: {

            get: function() {
              return use_local_storage;
            },
            set: function(bool) {
              if (SUPPORTS_LOCAL_STORAGE) {
                use_local_storage = bool;
                if (bool) {
                  dom.bind(window, 'unload', saveToLocalStorage);
                } else {
                  dom.unbind(window, 'unload', saveToLocalStorage);
                }
                localStorage.setItem(getLocalStorageHash(_this, 'isLocal'), bool);
              }
            }

          }

        });

    // Are we a root level GUI?
    if (common.isUndefined(params.parent)) {

      params.closed = false;

      dom.addClass(this.domElement, GUI.CLASS_MAIN);
      dom.makeSelectable(this.domElement, false);

      // Are we supposed to be loading locally?
      if (SUPPORTS_LOCAL_STORAGE) {

        if (use_local_storage) {

          _this.useLocalStorage = true;

          var saved_gui = localStorage.getItem(getLocalStorageHash(this, 'gui'));

          if (saved_gui) {
            params.load = JSON.parse(saved_gui);
          }

        }

      }

      this.__closeButton = document.createElement('div');
      this.__closeButton.innerHTML = GUI.TEXT_CLOSED;
      dom.addClass(this.__closeButton, GUI.CLASS_CLOSE_BUTTON);
      this.domElement.appendChild(this.__closeButton);

      dom.bind(this.__closeButton, 'click', function() {

        _this.closed = !_this.closed;


      });


      // Oh, you're a nested GUI!
    } else {

      if (params.closed === undefined) {
        params.closed = true;
      }

      var title_row_name = document.createTextNode(params.name);
      dom.addClass(title_row_name, 'controller-name');

      var title_row = addRow(_this, title_row_name);

      var on_click_title = function(e) {
        e.preventDefault();
        _this.closed = !_this.closed;
        return false;
      };

      dom.addClass(this.__ul, GUI.CLASS_CLOSED);

      dom.addClass(title_row, 'title');
      dom.bind(title_row, 'click', on_click_title);

      if (!params.closed) {
        this.closed = false;
      }

    }

    if (params.autoPlace) {

      if (common.isUndefined(params.parent)) {

        if (auto_place_virgin) {
          auto_place_container = document.createElement('div');
          dom.addClass(auto_place_container, CSS_NAMESPACE);
          dom.addClass(auto_place_container, GUI.CLASS_AUTO_PLACE_CONTAINER);
          document.body.appendChild(auto_place_container);
          auto_place_virgin = false;
        }

        // Put it in the dom for you.
        auto_place_container.appendChild(this.domElement);

        // Apply the auto styles
        dom.addClass(this.domElement, GUI.CLASS_AUTO_PLACE);

      }


      // Make it not elastic.
      if (!this.parent) setWidth(_this, params.width);

    }

    dom.bind(window, 'resize', function() { _this.onResize() });
    dom.bind(this.__ul, 'webkitTransitionEnd', function() { _this.onResize(); });
    dom.bind(this.__ul, 'transitionend', function() { _this.onResize() });
    dom.bind(this.__ul, 'oTransitionEnd', function() { _this.onResize() });
    this.onResize();


    if (params.resizable) {
      addResizeHandle(this);
    }

    function saveToLocalStorage() {
      localStorage.setItem(getLocalStorageHash(_this, 'gui'), JSON.stringify(_this.getSaveObject()));
    }

    var root = _this.getRoot();
    function resetWidth() {
        var root = _this.getRoot();
        root.width += 1;
        common.defer(function() {
          root.width -= 1;
        });
      }

      if (!params.parent) {
        resetWidth();
      }

  };

  GUI.toggleHide = function() {

    hide = !hide;
    common.each(hideable_guis, function(gui) {
      gui.domElement.style.zIndex = hide ? -999 : 999;
      gui.domElement.style.opacity = hide ? 0 : 1;
    });
  };

  GUI.CLASS_AUTO_PLACE = 'a';
  GUI.CLASS_AUTO_PLACE_CONTAINER = 'ac';
  GUI.CLASS_MAIN = 'main';
  GUI.CLASS_CONTROLLER_ROW = 'cr';
  GUI.CLASS_TOO_TALL = 'taller-than-window';
  GUI.CLASS_CLOSED = 'closed';
  GUI.CLASS_CLOSE_BUTTON = 'close-button';
  GUI.CLASS_DRAG = 'drag';

  GUI.DEFAULT_WIDTH = 245;
  GUI.TEXT_CLOSED = 'Close Controls';
  GUI.TEXT_OPEN = 'Open Controls';

  dom.bind(window, 'keydown', function(e) {

    if (document.activeElement.type !== 'text' &&
        (e.which === HIDE_KEY_CODE || e.keyCode == HIDE_KEY_CODE)) {
      GUI.toggleHide();
    }

  }, false);

  common.extend(

      GUI.prototype,

      /** @lends dat.gui.GUI */
      {

        /**
         * @param object
         * @param property
         * @returns {dat.controllers.Controller} The new controller that was added.
         * @instance
         */
        add: function(object, property) {

          return add(
              this,
              object,
              property,
              {
                factoryArgs: Array.prototype.slice.call(arguments, 2)
              }
          );

        },

        /**
         * @param object
         * @param property
         * @returns {dat.controllers.ColorController} The new controller that was added.
         * @instance
         */
        addColor: function(object, property) {

          return add(
              this,
              object,
              property,
              {
                color: true
              }
          );

        },

        /**
         * @param controller
         * @instance
         */
        remove: function(controller) {

          // TODO listening?
          this.__ul.removeChild(controller.__li);
          this.__controllers.slice(this.__controllers.indexOf(controller), 1);
          var _this = this;
          common.defer(function() {
            _this.onResize();
          });

        },

        destroy: function() {

          if (this.autoPlace) {
            auto_place_container.removeChild(this.domElement);
          }

        },

        /**
         * @param name
         * @returns {dat.gui.GUI} The new folder.
         * @throws {Error} if this GUI already has a folder by the specified
         * name
         * @instance
         */
        addFolder: function(name) {

          // We have to prevent collisions on names in order to have a key
          // by which to remember saved values
          if (this.__folders[name] !== undefined) {
            throw new Error('You already have a folder in this GUI by the' +
                ' name "' + name + '"');
          }

          var new_gui_params = { name: name, parent: this };

          // We need to pass down the autoPlace trait so that we can
          // attach event listeners to open/close folder actions to
          // ensure that a scrollbar appears if the window is too short.
          new_gui_params.autoPlace = this.autoPlace;

          // Do we have saved appearance data for this folder?

          if (this.load && // Anything loaded?
              this.load.folders && // Was my parent a dead-end?
              this.load.folders[name]) { // Did daddy remember me?

            // Start me closed if I was closed
            new_gui_params.closed = this.load.folders[name].closed;

            // Pass down the loaded data
            new_gui_params.load = this.load.folders[name];

          }

          var gui = new GUI(new_gui_params);
          this.__folders[name] = gui;

          var li = addRow(this, gui.domElement);
          dom.addClass(li, 'folder');
          return gui;

        },

        open: function() {
          this.closed = false;
        },

        close: function() {
          this.closed = true;
        },

        onResize: function() {

          var root = this.getRoot();

          if (root.scrollable) {

            var top = dom.getOffset(root.__ul).top;
            var h = 0;

            common.each(root.__ul.childNodes, function(node) {
              if (! (root.autoPlace && node === root.__save_row))
                h += dom.getHeight(node);
            });

            if (window.innerHeight - top - CLOSE_BUTTON_HEIGHT < h) {
              dom.addClass(root.domElement, GUI.CLASS_TOO_TALL);
              root.__ul.style.height = window.innerHeight - top - CLOSE_BUTTON_HEIGHT + 'px';
            } else {
              dom.removeClass(root.domElement, GUI.CLASS_TOO_TALL);
              root.__ul.style.height = 'auto';
            }

          }

          if (root.__resize_handle) {
            common.defer(function() {
              root.__resize_handle.style.height = root.__ul.offsetHeight + 'px';
            });
          }

          if (root.__closeButton) {
            root.__closeButton.style.width = root.width + 'px';
          }

        },

        /**
         * Mark objects for saving. The order of these objects cannot change as
         * the GUI grows. When remembering new objects, append them to the end
         * of the list.
         *
         * @param {Object...} objects
         * @throws {Error} if not called on a top level GUI.
         * @instance
         */
        remember: function() {

          if (common.isUndefined(SAVE_DIALOGUE)) {
            SAVE_DIALOGUE = new CenteredDiv();
            SAVE_DIALOGUE.domElement.innerHTML = saveDialogueContents;
          }

          if (this.parent) {
            throw new Error("You can only call remember on a top level GUI.");
          }

          var _this = this;

          common.each(Array.prototype.slice.call(arguments), function(object) {
            if (_this.__rememberedObjects.length == 0) {
              addSaveMenu(_this);
            }
            if (_this.__rememberedObjects.indexOf(object) == -1) {
              _this.__rememberedObjects.push(object);
            }
          });

          if (this.autoPlace) {
            // Set save row width
            setWidth(this, this.width);
          }

        },

        /**
         * @returns {dat.gui.GUI} the topmost parent GUI of a nested GUI.
         * @instance
         */
        getRoot: function() {
          var gui = this;
          while (gui.parent) {
            gui = gui.parent;
          }
          return gui;
        },

        /**
         * @returns {Object} a JSON object representing the current state of
         * this GUI as well as its remembered properties.
         * @instance
         */
        getSaveObject: function() {

          var toReturn = this.load;

          toReturn.closed = this.closed;

          // Am I remembering any values?
          if (this.__rememberedObjects.length > 0) {

            toReturn.preset = this.preset;

            if (!toReturn.remembered) {
              toReturn.remembered = {};
            }

            toReturn.remembered[this.preset] = getCurrentPreset(this);

          }

          toReturn.folders = {};
          common.each(this.__folders, function(element, key) {
            toReturn.folders[key] = element.getSaveObject();
          });

          return toReturn;

        },

        save: function() {

          if (!this.load.remembered) {
            this.load.remembered = {};
          }

          this.load.remembered[this.preset] = getCurrentPreset(this);
          markPresetModified(this, false);

        },

        saveAs: function(presetName) {

          if (!this.load.remembered) {

            // Retain default values upon first save
            this.load.remembered = {};
            this.load.remembered[DEFAULT_DEFAULT_PRESET_NAME] = getCurrentPreset(this, true);

          }

          this.load.remembered[presetName] = getCurrentPreset(this);
          this.preset = presetName;
          addPresetOption(this, presetName, true);

        },

        revert: function(gui) {

          common.each(this.__controllers, function(controller) {
            // Make revert work on Default.
            if (!this.getRoot().load.remembered) {
              controller.setValue(controller.initialValue);
            } else {
              recallSavedValue(gui || this.getRoot(), controller);
            }
          }, this);

          common.each(this.__folders, function(folder) {
            folder.revert(folder);
          });

          if (!gui) {
            markPresetModified(this.getRoot(), false);
          }


        },

        listen: function(controller) {

          var init = this.__listening.length == 0;
          this.__listening.push(controller);
          if (init) updateDisplays(this.__listening);

        }

      }

  );

  function add(gui, object, property, params) {

    if (object[property] === undefined) {
      throw new Error("Object " + object + " has no property \"" + property + "\"");
    }

    var controller;

    if (params.color) {

      controller = new ColorController(object, property);

    } else {

      var factoryArgs = [object,property].concat(params.factoryArgs);
      controller = controllerFactory.apply(gui, factoryArgs);

    }

    if (params.before instanceof Controller) {
      params.before = params.before.__li;
    }

    recallSavedValue(gui, controller);

    dom.addClass(controller.domElement, 'c');

    var name = document.createElement('span');
    dom.addClass(name, 'property-name');
    name.innerHTML = controller.property;

    var container = document.createElement('div');
    container.appendChild(name);
    container.appendChild(controller.domElement);

    var li = addRow(gui, container, params.before);

    dom.addClass(li, GUI.CLASS_CONTROLLER_ROW);
    dom.addClass(li, typeof controller.getValue());

    augmentController(gui, li, controller);

    gui.__controllers.push(controller);

    return controller;

  }

  /**
   * Add a row to the end of the GUI or before another row.
   *
   * @param gui
   * @param [dom] If specified, inserts the dom content in the new row
   * @param [liBefore] If specified, places the new row before another row
   */
  function addRow(gui, dom, liBefore) {
    var li = document.createElement('li');
    if (dom) li.appendChild(dom);
    if (liBefore) {
      gui.__ul.insertBefore(li, params.before);
    } else {
      gui.__ul.appendChild(li);
    }
    gui.onResize();
    return li;
  }

  function augmentController(gui, li, controller) {

    controller.__li = li;
    controller.__gui = gui;

    common.extend(controller, {

      options: function(options) {

        if (arguments.length > 1) {
          controller.remove();

          return add(
              gui,
              controller.object,
              controller.property,
              {
                before: controller.__li.nextElementSibling,
                factoryArgs: [common.toArray(arguments)]
              }
          );

        }

        if (common.isArray(options) || common.isObject(options)) {
          controller.remove();

          return add(
              gui,
              controller.object,
              controller.property,
              {
                before: controller.__li.nextElementSibling,
                factoryArgs: [options]
              }
          );

        }

      },

      name: function(v) {
        controller.__li.firstElementChild.firstElementChild.innerHTML = v;
        return controller;
      },

      listen: function() {
        controller.__gui.listen(controller);
        return controller;
      },

      remove: function() {
        controller.__gui.remove(controller);
        return controller;
      }

    });

    // All sliders should be accompanied by a box.
    if (controller instanceof NumberControllerSlider) {

      var box = new NumberControllerBox(controller.object, controller.property,
          { min: controller.__min, max: controller.__max, step: controller.__step });

      common.each(['updateDisplay', 'onChange', 'onFinishChange'], function(method) {
        var pc = controller[method];
        var pb = box[method];
        controller[method] = box[method] = function() {
          var args = Array.prototype.slice.call(arguments);
          pc.apply(controller, args);
          return pb.apply(box, args);
        }
      });

      dom.addClass(li, 'has-slider');
      controller.domElement.insertBefore(box.domElement, controller.domElement.firstElementChild);

    }
    else if (controller instanceof NumberControllerBox) {

      var r = function(returned) {

        // Have we defined both boundaries?
        if (common.isNumber(controller.__min) && common.isNumber(controller.__max)) {

          // Well, then lets just replace this with a slider.
          controller.remove();
          return add(
              gui,
              controller.object,
              controller.property,
              {
                before: controller.__li.nextElementSibling,
                factoryArgs: [controller.__min, controller.__max, controller.__step]
              });

        }

        return returned;

      };

      controller.min = common.compose(r, controller.min);
      controller.max = common.compose(r, controller.max);

    }
    else if (controller instanceof BooleanController) {

      dom.bind(li, 'click', function() {
        dom.fakeEvent(controller.__checkbox, 'click');
      });

      dom.bind(controller.__checkbox, 'click', function(e) {
        e.stopPropagation(); // Prevents double-toggle
      })

    }
    else if (controller instanceof FunctionController) {

      dom.bind(li, 'click', function() {
        dom.fakeEvent(controller.__button, 'click');
      });

      dom.bind(li, 'mouseover', function() {
        dom.addClass(controller.__button, 'hover');
      });

      dom.bind(li, 'mouseout', function() {
        dom.removeClass(controller.__button, 'hover');
      });

    }
    else if (controller instanceof ColorController) {

      dom.addClass(li, 'color');
      controller.updateDisplay = common.compose(function(r) {
        li.style.borderLeftColor = controller.__color.toString();
        return r;
      }, controller.updateDisplay);

      controller.updateDisplay();

    }

    controller.setValue = common.compose(function(r) {
      if (gui.getRoot().__preset_select && controller.isModified()) {
        markPresetModified(gui.getRoot(), true);
      }
      return r;
    }, controller.setValue);

  }

  function recallSavedValue(gui, controller) {

    // Find the topmost GUI, that's where remembered objects live.
    var root = gui.getRoot();

    // Does the object we're controlling match anything we've been told to
    // remember?
    var matched_index = root.__rememberedObjects.indexOf(controller.object);

    // Why yes, it does!
    if (matched_index != -1) {

      // Let me fetch a map of controllers for thcommon.isObject.
      var controller_map =
          root.__rememberedObjectIndecesToControllers[matched_index];

      // Ohp, I believe this is the first controller we've created for this
      // object. Lets make the map fresh.
      if (controller_map === undefined) {
        controller_map = {};
        root.__rememberedObjectIndecesToControllers[matched_index] =
            controller_map;
      }

      // Keep track of this controller
      controller_map[controller.property] = controller;

      // Okay, now have we saved any values for this controller?
      if (root.load && root.load.remembered) {

        var preset_map = root.load.remembered;

        // Which preset are we trying to load?
        var preset;

        if (preset_map[gui.preset]) {

          preset = preset_map[gui.preset];

        } else if (preset_map[DEFAULT_DEFAULT_PRESET_NAME]) {

          // Uhh, you can have the default instead?
          preset = preset_map[DEFAULT_DEFAULT_PRESET_NAME];

        } else {

          // Nada.

          return;

        }


        // Did the loaded object remember thcommon.isObject?
        if (preset[matched_index] &&

          // Did we remember this particular property?
            preset[matched_index][controller.property] !== undefined) {

          // We did remember something for this guy ...
          var value = preset[matched_index][controller.property];

          // And that's what it is.
          controller.initialValue = value;
          controller.setValue(value);

        }

      }

    }

  }

  function getLocalStorageHash(gui, key) {
    // TODO how does this deal with multiple GUI's?
    return document.location.href + '.' + key;

  }

  function addSaveMenu(gui) {

    var div = gui.__save_row = document.createElement('li');

    dom.addClass(gui.domElement, 'has-save');

    gui.__ul.insertBefore(div, gui.__ul.firstChild);

    dom.addClass(div, 'save-row');

    var gears = document.createElement('span');
    gears.innerHTML = '&nbsp;';
    dom.addClass(gears, 'button gears');

    // TODO replace with FunctionController
    var button = document.createElement('span');
    button.innerHTML = 'Save';
    dom.addClass(button, 'button');
    dom.addClass(button, 'save');

    var button2 = document.createElement('span');
    button2.innerHTML = 'New';
    dom.addClass(button2, 'button');
    dom.addClass(button2, 'save-as');

    var button3 = document.createElement('span');
    button3.innerHTML = 'Revert';
    dom.addClass(button3, 'button');
    dom.addClass(button3, 'revert');

    var select = gui.__preset_select = document.createElement('select');

    if (gui.load && gui.load.remembered) {

      common.each(gui.load.remembered, function(value, key) {
        addPresetOption(gui, key, key == gui.preset);
      });

    } else {
      addPresetOption(gui, DEFAULT_DEFAULT_PRESET_NAME, false);
    }

    dom.bind(select, 'change', function() {


      for (var index = 0; index < gui.__preset_select.length; index++) {
        gui.__preset_select[index].innerHTML = gui.__preset_select[index].value;
      }

      gui.preset = this.value;

    });

    div.appendChild(select);
    div.appendChild(gears);
    div.appendChild(button);
    div.appendChild(button2);
    div.appendChild(button3);

    if (SUPPORTS_LOCAL_STORAGE) {

      var saveLocally = document.getElementById('dg-save-locally');
      var explain = document.getElementById('dg-local-explain');

      saveLocally.style.display = 'block';

      var localStorageCheckBox = document.getElementById('dg-local-storage');

      if (localStorage.getItem(getLocalStorageHash(gui, 'isLocal')) === 'true') {
        localStorageCheckBox.setAttribute('checked', 'checked');
      }

      function showHideExplain() {
        explain.style.display = gui.useLocalStorage ? 'block' : 'none';
      }

      showHideExplain();

      // TODO: Use a boolean controller, fool!
      dom.bind(localStorageCheckBox, 'change', function() {
        gui.useLocalStorage = !gui.useLocalStorage;
        showHideExplain();
      });

    }

    var newConstructorTextArea = document.getElementById('dg-new-constructor');

    dom.bind(newConstructorTextArea, 'keydown', function(e) {
      if (e.metaKey && (e.which === 67 || e.keyCode == 67)) {
        SAVE_DIALOGUE.hide();
      }
    });

    dom.bind(gears, 'click', function() {
      newConstructorTextArea.innerHTML = JSON.stringify(gui.getSaveObject(), undefined, 2);
      SAVE_DIALOGUE.show();
      newConstructorTextArea.focus();
      newConstructorTextArea.select();
    });

    dom.bind(button, 'click', function() {
      gui.save();
    });

    dom.bind(button2, 'click', function() {
      var presetName = prompt('Enter a new preset name.');
      if (presetName) gui.saveAs(presetName);
    });

    dom.bind(button3, 'click', function() {
      gui.revert();
    });

//    div.appendChild(button2);

  }

  function addResizeHandle(gui) {

    gui.__resize_handle = document.createElement('div');

    common.extend(gui.__resize_handle.style, {

      width: '6px',
      marginLeft: '-3px',
      height: '200px',
      cursor: 'ew-resize',
      position: 'absolute'
//      border: '1px solid blue'

    });

    var pmouseX;

    dom.bind(gui.__resize_handle, 'mousedown', dragStart);
    dom.bind(gui.__closeButton, 'mousedown', dragStart);

    gui.domElement.insertBefore(gui.__resize_handle, gui.domElement.firstElementChild);

    function dragStart(e) {

      e.preventDefault();

      pmouseX = e.clientX;

      dom.addClass(gui.__closeButton, GUI.CLASS_DRAG);
      dom.bind(window, 'mousemove', drag);
      dom.bind(window, 'mouseup', dragStop);

      return false;

    }

    function drag(e) {

      e.preventDefault();

      gui.width += pmouseX - e.clientX;
      gui.onResize();
      pmouseX = e.clientX;

      return false;

    }

    function dragStop() {

      dom.removeClass(gui.__closeButton, GUI.CLASS_DRAG);
      dom.unbind(window, 'mousemove', drag);
      dom.unbind(window, 'mouseup', dragStop);

    }

  }

  function setWidth(gui, w) {
    gui.domElement.style.width = w + 'px';
    // Auto placed save-rows are position fixed, so we have to
    // set the width manually if we want it to bleed to the edge
    if (gui.__save_row && gui.autoPlace) {
      gui.__save_row.style.width = w + 'px';
    }if (gui.__closeButton) {
      gui.__closeButton.style.width = w + 'px';
    }
  }

  function getCurrentPreset(gui, useInitialValues) {

    var toReturn = {};

    // For each object I'm remembering
    common.each(gui.__rememberedObjects, function(val, index) {

      var saved_values = {};

      // The controllers I've made for thcommon.isObject by property
      var controller_map =
          gui.__rememberedObjectIndecesToControllers[index];

      // Remember each value for each property
      common.each(controller_map, function(controller, property) {
        saved_values[property] = useInitialValues ? controller.initialValue : controller.getValue();
      });

      // Save the values for thcommon.isObject
      toReturn[index] = saved_values;

    });

    return toReturn;

  }

  function addPresetOption(gui, name, setSelected) {
    var opt = document.createElement('option');
    opt.innerHTML = name;
    opt.value = name;
    gui.__preset_select.appendChild(opt);
    if (setSelected) {
      gui.__preset_select.selectedIndex = gui.__preset_select.length - 1;
    }
  }

  function setPresetSelectIndex(gui) {
    for (var index = 0; index < gui.__preset_select.length; index++) {
      if (gui.__preset_select[index].value == gui.preset) {
        gui.__preset_select.selectedIndex = index;
      }
    }
  }

  function markPresetModified(gui, modified) {
    var opt = gui.__preset_select[gui.__preset_select.selectedIndex];
//    console.log('mark', modified, opt);
    if (modified) {
      opt.innerHTML = opt.value + "*";
    } else {
      opt.innerHTML = opt.value;
    }
  }

  function updateDisplays(controllerArray) {


    if (controllerArray.length != 0) {

      requestAnimationFrame(function() {
        updateDisplays(controllerArray);
      });

    }

    common.each(controllerArray, function(c) {
      c.updateDisplay();
    });

  }

  return GUI;

})(dat.utils.css,
"<div id=\"dg-save\" class=\"dg dialogue\">\n\n  Here's the new load parameter for your <code>GUI</code>'s constructor:\n\n  <textarea id=\"dg-new-constructor\"></textarea>\n\n  <div id=\"dg-save-locally\">\n\n    <input id=\"dg-local-storage\" type=\"checkbox\"/> Automatically save\n    values to <code>localStorage</code> on exit.\n\n    <div id=\"dg-local-explain\">The values saved to <code>localStorage</code> will\n      override those passed to <code>dat.GUI</code>'s constructor. This makes it\n      easier to work incrementally, but <code>localStorage</code> is fragile,\n      and your friends may not see the same values you do.\n      \n    </div>\n    \n  </div>\n\n</div>",
".dg ul{list-style:none;margin:0;padding:0;width:100%;clear:both}.dg.ac{position:fixed;top:0;left:0;right:0;height:0;z-index:0}.dg:not(.ac) .main{overflow:hidden}.dg.main{-webkit-transition:opacity 0.1s linear;-o-transition:opacity 0.1s linear;-moz-transition:opacity 0.1s linear;transition:opacity 0.1s linear}.dg.main.taller-than-window{overflow-y:auto}.dg.main.taller-than-window .close-button{opacity:1;margin-top:-1px;border-top:1px solid #2c2c2c}.dg.main ul.closed .close-button{opacity:1 !important}.dg.main:hover .close-button,.dg.main .close-button.drag{opacity:1}.dg.main .close-button{-webkit-transition:opacity 0.1s linear;-o-transition:opacity 0.1s linear;-moz-transition:opacity 0.1s linear;transition:opacity 0.1s linear;border:0;position:absolute;line-height:19px;height:20px;cursor:pointer;text-align:center;background-color:#000}.dg.main .close-button:hover{background-color:#111}.dg.a{float:right;margin-right:15px;overflow-x:hidden}.dg.a.has-save ul{margin-top:27px}.dg.a.has-save ul.closed{margin-top:0}.dg.a .save-row{position:fixed;top:0;z-index:1002}.dg li{-webkit-transition:height 0.1s ease-out;-o-transition:height 0.1s ease-out;-moz-transition:height 0.1s ease-out;transition:height 0.1s ease-out}.dg li:not(.folder){cursor:auto;height:27px;line-height:27px;overflow:hidden;padding:0 4px 0 5px}.dg li.folder{padding:0;border-left:4px solid rgba(0,0,0,0)}.dg li.title{cursor:pointer;margin-left:-4px}.dg .closed li:not(.title),.dg .closed ul li,.dg .closed ul li > *{height:0;overflow:hidden;border:0}.dg .cr{clear:both;padding-left:3px;height:27px}.dg .property-name{cursor:default;float:left;clear:left;width:40%;overflow:hidden;text-overflow:ellipsis}.dg .c{float:left;width:60%}.dg .c input[type=text]{border:0;margin-top:4px;padding:3px;width:100%;float:right}.dg .has-slider input[type=text]{width:30%;margin-left:0}.dg .slider{float:left;width:66%;margin-left:-5px;margin-right:0;height:19px;margin-top:4px}.dg .slider-fg{height:100%}.dg .c input[type=checkbox]{margin-top:9px}.dg .c select{margin-top:5px}.dg .cr.function,.dg .cr.function .property-name,.dg .cr.function *,.dg .cr.boolean,.dg .cr.boolean *{cursor:pointer}.dg .selector{display:none;position:absolute;margin-left:-9px;margin-top:23px;z-index:10}.dg .c:hover .selector,.dg .selector.drag{display:block}.dg li.save-row{padding:0}.dg li.save-row .button{display:inline-block;padding:0px 6px}.dg.dialogue{background-color:#222;width:460px;padding:15px;font-size:13px;line-height:15px}#dg-new-constructor{padding:10px;color:#222;font-family:Monaco, monospace;font-size:10px;border:0;resize:none;box-shadow:inset 1px 1px 1px #888;word-wrap:break-word;margin:12px 0;display:block;width:440px;overflow-y:scroll;height:100px;position:relative}#dg-local-explain{display:none;font-size:11px;line-height:17px;border-radius:3px;background-color:#333;padding:8px;margin-top:10px}#dg-local-explain code{font-size:10px}#dat-gui-save-locally{display:none}.dg{color:#eee;font:11px 'Lucida Grande', sans-serif;text-shadow:0 -1px 0 #111}.dg.main::-webkit-scrollbar{width:5px;background:#1a1a1a}.dg.main::-webkit-scrollbar-corner{height:0;display:none}.dg.main::-webkit-scrollbar-thumb{border-radius:5px;background:#676767}.dg li:not(.folder){background:#1a1a1a;border-bottom:1px solid #2c2c2c}.dg li.save-row{line-height:25px;background:#dad5cb;border:0}.dg li.save-row select{margin-left:5px;width:108px}.dg li.save-row .button{margin-left:5px;margin-top:1px;border-radius:2px;font-size:9px;line-height:7px;padding:4px 4px 5px 4px;background:#c5bdad;color:#fff;text-shadow:0 1px 0 #b0a58f;box-shadow:0 -1px 0 #b0a58f;cursor:pointer}.dg li.save-row .button.gears{background:#c5bdad url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAANCAYAAAB/9ZQ7AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQJJREFUeNpiYKAU/P//PwGIC/ApCABiBSAW+I8AClAcgKxQ4T9hoMAEUrxx2QSGN6+egDX+/vWT4e7N82AMYoPAx/evwWoYoSYbACX2s7KxCxzcsezDh3evFoDEBYTEEqycggWAzA9AuUSQQgeYPa9fPv6/YWm/Acx5IPb7ty/fw+QZblw67vDs8R0YHyQhgObx+yAJkBqmG5dPPDh1aPOGR/eugW0G4vlIoTIfyFcA+QekhhHJhPdQxbiAIguMBTQZrPD7108M6roWYDFQiIAAv6Aow/1bFwXgis+f2LUAynwoIaNcz8XNx3Dl7MEJUDGQpx9gtQ8YCueB+D26OECAAQDadt7e46D42QAAAABJRU5ErkJggg==) 2px 1px no-repeat;height:7px;width:8px}.dg li.save-row .button:hover{background-color:#bab19e;box-shadow:0 -1px 0 #b0a58f}.dg li.folder{border-bottom:0}.dg li.title{padding-left:16px;background:#000 url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlI+hKgFxoCgAOw==) 6px 10px no-repeat;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.2)}.dg .closed li.title{background-image:url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlGIWqMCbWAEAOw==)}.dg .cr.boolean{border-left:3px solid #806787}.dg .cr.function{border-left:3px solid #e61d5f}.dg .cr.number{border-left:3px solid #2fa1d6}.dg .cr.number input[type=text]{color:#2fa1d6}.dg .cr.string{border-left:3px solid #1ed36f}.dg .cr.string input[type=text]{color:#1ed36f}.dg .cr.function:hover,.dg .cr.boolean:hover{background:#111}.dg .c input[type=text]{background:#303030;outline:none}.dg .c input[type=text]:hover{background:#3c3c3c}.dg .c input[type=text]:focus{background:#494949;color:#fff}.dg .c .slider{background:#303030;cursor:ew-resize}.dg .c .slider-fg{background:#2fa1d6}.dg .c .slider:hover{background:#3c3c3c}.dg .c .slider:hover .slider-fg{background:#44abda}\n",
dat.controllers.factory = (function (OptionController, NumberControllerBox, NumberControllerSlider, StringController, FunctionController, BooleanController, common) {

      return function(object, property) {

        var initialValue = object[property];

        // Providing options?
        if (common.isArray(arguments[2]) || common.isObject(arguments[2])) {
          return new OptionController(object, property, arguments[2]);
        }

        // Providing a map?

        if (common.isNumber(initialValue)) {

          if (common.isNumber(arguments[2]) && common.isNumber(arguments[3])) {

            // Has min and max.
            return new NumberControllerSlider(object, property, arguments[2], arguments[3]);

          } else {

            return new NumberControllerBox(object, property, { min: arguments[2], max: arguments[3] });

          }

        }

        if (common.isString(initialValue)) {
          return new StringController(object, property);
        }

        if (common.isFunction(initialValue)) {
          return new FunctionController(object, property, '');
        }

        if (common.isBoolean(initialValue)) {
          return new BooleanController(object, property);
        }

      }

    })(dat.controllers.OptionController,
dat.controllers.NumberControllerBox,
dat.controllers.NumberControllerSlider,
dat.controllers.StringController = (function (Controller, dom, common) {

  /**
   * @class Provides a text input to alter the string property of an object.
   *
   * @extends dat.controllers.Controller
   *
   * @param {Object} object The object to be manipulated
   * @param {string} property The name of the property to be manipulated
   *
   * @member dat.controllers
   */
  var StringController = function(object, property) {

    StringController.superclass.call(this, object, property);

    var _this = this;

    this.__input = document.createElement('input');
    this.__input.setAttribute('type', 'text');

    dom.bind(this.__input, 'keyup', onChange);
    dom.bind(this.__input, 'change', onChange);
    dom.bind(this.__input, 'blur', onBlur);
    dom.bind(this.__input, 'keydown', function(e) {
      if (e.keyCode === 13) {
        this.blur();
      }
    });
    

    function onChange() {
      _this.setValue(_this.__input.value);
    }

    function onBlur() {
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }

    this.updateDisplay();

    this.domElement.appendChild(this.__input);

  };

  StringController.superclass = Controller;

  common.extend(

      StringController.prototype,
      Controller.prototype,

      {

        updateDisplay: function() {
          // Stops the caret from moving on account of:
          // keyup -> setValue -> updateDisplay
          if (!dom.isActive(this.__input)) {
            this.__input.value = this.getValue();
          }
          return StringController.superclass.prototype.updateDisplay.call(this);
        }

      }

  );

  return StringController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.utils.common),
dat.controllers.FunctionController,
dat.controllers.BooleanController,
dat.utils.common),
dat.controllers.Controller,
dat.controllers.BooleanController,
dat.controllers.FunctionController,
dat.controllers.NumberControllerBox,
dat.controllers.NumberControllerSlider,
dat.controllers.OptionController,
dat.controllers.ColorController = (function (Controller, dom, Color, interpret, common) {

  var ColorController = function(object, property) {

    ColorController.superclass.call(this, object, property);

    this.__color = new Color(this.getValue());
    this.__temp = new Color(0);

    var _this = this;

    this.domElement = document.createElement('div');

    dom.makeSelectable(this.domElement, false);

    this.__selector = document.createElement('div');
    this.__selector.className = 'selector';

    this.__saturation_field = document.createElement('div');
    this.__saturation_field.className = 'saturation-field';

    this.__field_knob = document.createElement('div');
    this.__field_knob.className = 'field-knob';
    this.__field_knob_border = '2px solid ';

    this.__hue_knob = document.createElement('div');
    this.__hue_knob.className = 'hue-knob';

    this.__hue_field = document.createElement('div');
    this.__hue_field.className = 'hue-field';

    this.__input = document.createElement('input');
    this.__input.type = 'text';
    this.__input_textShadow = '0 1px 1px ';

    dom.bind(this.__input, 'keydown', function(e) {
      if (e.keyCode === 13) { // on enter
        onBlur.call(this);
      }
    });

    dom.bind(this.__input, 'blur', onBlur);

    dom.bind(this.__selector, 'mousedown', function(e) {

      dom
        .addClass(this, 'drag')
        .bind(window, 'mouseup', function(e) {
          dom.removeClass(_this.__selector, 'drag');
        });

    });

    var value_field = document.createElement('div');

    common.extend(this.__selector.style, {
      width: '122px',
      height: '102px',
      padding: '3px',
      backgroundColor: '#222',
      boxShadow: '0px 1px 3px rgba(0,0,0,0.3)'
    });

    common.extend(this.__field_knob.style, {
      position: 'absolute',
      width: '12px',
      height: '12px',
      border: this.__field_knob_border + (this.__color.v < .5 ? '#fff' : '#000'),
      boxShadow: '0px 1px 3px rgba(0,0,0,0.5)',
      borderRadius: '12px',
      zIndex: 1
    });
    
    common.extend(this.__hue_knob.style, {
      position: 'absolute',
      width: '15px',
      height: '2px',
      borderRight: '4px solid #fff',
      zIndex: 1
    });

    common.extend(this.__saturation_field.style, {
      width: '100px',
      height: '100px',
      border: '1px solid #555',
      marginRight: '3px',
      display: 'inline-block',
      cursor: 'pointer'
    });

    common.extend(value_field.style, {
      width: '100%',
      height: '100%',
      background: 'none'
    });
    
    linearGradient(value_field, 'top', 'rgba(0,0,0,0)', '#000');

    common.extend(this.__hue_field.style, {
      width: '15px',
      height: '100px',
      display: 'inline-block',
      border: '1px solid #555',
      cursor: 'ns-resize'
    });

    hueGradient(this.__hue_field);

    common.extend(this.__input.style, {
      outline: 'none',
//      width: '120px',
      textAlign: 'center',
//      padding: '4px',
//      marginBottom: '6px',
      color: '#fff',
      border: 0,
      fontWeight: 'bold',
      textShadow: this.__input_textShadow + 'rgba(0,0,0,0.7)'
    });

    dom.bind(this.__saturation_field, 'mousedown', fieldDown);
    dom.bind(this.__field_knob, 'mousedown', fieldDown);

    dom.bind(this.__hue_field, 'mousedown', function(e) {
      setH(e);
      dom.bind(window, 'mousemove', setH);
      dom.bind(window, 'mouseup', unbindH);
    });

    function fieldDown(e) {
      setSV(e);
      // document.body.style.cursor = 'none';
      dom.bind(window, 'mousemove', setSV);
      dom.bind(window, 'mouseup', unbindSV);
    }

    function unbindSV() {
      dom.unbind(window, 'mousemove', setSV);
      dom.unbind(window, 'mouseup', unbindSV);
      // document.body.style.cursor = 'default';
    }

    function onBlur() {
      var i = interpret(this.value);
      if (i !== false) {
        _this.__color.__state = i;
        _this.setValue(_this.__color.toOriginal());
      } else {
        this.value = _this.__color.toString();
      }
    }

    function unbindH() {
      dom.unbind(window, 'mousemove', setH);
      dom.unbind(window, 'mouseup', unbindH);
    }

    this.__saturation_field.appendChild(value_field);
    this.__selector.appendChild(this.__field_knob);
    this.__selector.appendChild(this.__saturation_field);
    this.__selector.appendChild(this.__hue_field);
    this.__hue_field.appendChild(this.__hue_knob);

    this.domElement.appendChild(this.__input);
    this.domElement.appendChild(this.__selector);

    this.updateDisplay();

    function setSV(e) {

      e.preventDefault();

      var w = dom.getWidth(_this.__saturation_field);
      var o = dom.getOffset(_this.__saturation_field);
      var s = (e.clientX - o.left + document.body.scrollLeft) / w;
      var v = 1 - (e.clientY - o.top + document.body.scrollTop) / w;

      if (v > 1) v = 1;
      else if (v < 0) v = 0;

      if (s > 1) s = 1;
      else if (s < 0) s = 0;

      _this.__color.v = v;
      _this.__color.s = s;

      _this.setValue(_this.__color.toOriginal());


      return false;

    }

    function setH(e) {

      e.preventDefault();

      var s = dom.getHeight(_this.__hue_field);
      var o = dom.getOffset(_this.__hue_field);
      var h = 1 - (e.clientY - o.top + document.body.scrollTop) / s;

      if (h > 1) h = 1;
      else if (h < 0) h = 0;

      _this.__color.h = h * 360;

      _this.setValue(_this.__color.toOriginal());

      return false;

    }

  };

  ColorController.superclass = Controller;

  common.extend(

      ColorController.prototype,
      Controller.prototype,

      {

        updateDisplay: function() {

          var i = interpret(this.getValue());

          if (i !== false) {

            var mismatch = false;

            // Check for mismatch on the interpreted value.

            common.each(Color.COMPONENTS, function(component) {
              if (!common.isUndefined(i[component]) &&
                  !common.isUndefined(this.__color.__state[component]) &&
                  i[component] !== this.__color.__state[component]) {
                mismatch = true;
                return {}; // break
              }
            }, this);

            // If nothing diverges, we keep our previous values
            // for statefulness, otherwise we recalculate fresh
            if (mismatch) {
              common.extend(this.__color.__state, i);
            }

          }

          common.extend(this.__temp.__state, this.__color.__state);

          this.__temp.a = 1;

          var flip = (this.__color.v < .5 || this.__color.s > .5) ? 255 : 0;
          var _flip = 255 - flip;

          common.extend(this.__field_knob.style, {
            marginLeft: 100 * this.__color.s - 7 + 'px',
            marginTop: 100 * (1 - this.__color.v) - 7 + 'px',
            backgroundColor: this.__temp.toString(),
            border: this.__field_knob_border + 'rgb(' + flip + ',' + flip + ',' + flip +')'
          });

          this.__hue_knob.style.marginTop = (1 - this.__color.h / 360) * 100 + 'px'

          this.__temp.s = 1;
          this.__temp.v = 1;

          linearGradient(this.__saturation_field, 'left', '#fff', this.__temp.toString());

          common.extend(this.__input.style, {
            backgroundColor: this.__input.value = this.__color.toString(),
            color: 'rgb(' + flip + ',' + flip + ',' + flip +')',
            textShadow: this.__input_textShadow + 'rgba(' + _flip + ',' + _flip + ',' + _flip +',.7)'
          });

        }

      }

  );
  
  var vendors = ['-moz-','-o-','-webkit-','-ms-',''];
  
  function linearGradient(elem, x, a, b) {
    elem.style.background = '';
    common.each(vendors, function(vendor) {
      elem.style.cssText += 'background: ' + vendor + 'linear-gradient('+x+', '+a+' 0%, ' + b + ' 100%); ';
    });
  }
  
  function hueGradient(elem) {
    elem.style.background = '';
    elem.style.cssText += 'background: -moz-linear-gradient(top,  #ff0000 0%, #ff00ff 17%, #0000ff 34%, #00ffff 50%, #00ff00 67%, #ffff00 84%, #ff0000 100%);'
    elem.style.cssText += 'background: -webkit-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);'
    elem.style.cssText += 'background: -o-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);'
    elem.style.cssText += 'background: -ms-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);'
    elem.style.cssText += 'background: linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);'
  }


  return ColorController;

})(dat.controllers.Controller,
dat.dom.dom,
dat.color.Color = (function (interpret, math, toString, common) {

  var Color = function() {

    this.__state = interpret.apply(this, arguments);

    if (this.__state === false) {
      throw 'Failed to interpret color arguments';
    }

    this.__state.a = this.__state.a || 1;


  };

  Color.COMPONENTS = ['r','g','b','h','s','v','hex','a'];

  common.extend(Color.prototype, {

    toString: function() {
      return toString(this);
    },

    toOriginal: function() {
      return this.__state.conversion.write(this);
    }

  });

  defineRGBComponent(Color.prototype, 'r', 2);
  defineRGBComponent(Color.prototype, 'g', 1);
  defineRGBComponent(Color.prototype, 'b', 0);

  defineHSVComponent(Color.prototype, 'h');
  defineHSVComponent(Color.prototype, 's');
  defineHSVComponent(Color.prototype, 'v');

  Object.defineProperty(Color.prototype, 'a', {

    get: function() {
      return this.__state.a;
    },

    set: function(v) {
      this.__state.a = v;
    }

  });

  Object.defineProperty(Color.prototype, 'hex', {

    get: function() {

      if (!this.__state.space !== 'HEX') {
        this.__state.hex = math.rgb_to_hex(this.r, this.g, this.b);
      }

      return this.__state.hex;

    },

    set: function(v) {

      this.__state.space = 'HEX';
      this.__state.hex = v;

    }

  });

  function defineRGBComponent(target, component, componentHexIndex) {

    Object.defineProperty(target, component, {

      get: function() {

        if (this.__state.space === 'RGB') {
          return this.__state[component];
        }

        recalculateRGB(this, component, componentHexIndex);

        return this.__state[component];

      },

      set: function(v) {

        if (this.__state.space !== 'RGB') {
          recalculateRGB(this, component, componentHexIndex);
          this.__state.space = 'RGB';
        }

        this.__state[component] = v;

      }

    });

  }

  function defineHSVComponent(target, component) {

    Object.defineProperty(target, component, {

      get: function() {

        if (this.__state.space === 'HSV')
          return this.__state[component];

        recalculateHSV(this);

        return this.__state[component];

      },

      set: function(v) {

        if (this.__state.space !== 'HSV') {
          recalculateHSV(this);
          this.__state.space = 'HSV';
        }

        this.__state[component] = v;

      }

    });

  }

  function recalculateRGB(color, component, componentHexIndex) {

    if (color.__state.space === 'HEX') {

      color.__state[component] = math.component_from_hex(color.__state.hex, componentHexIndex);

    } else if (color.__state.space === 'HSV') {

      common.extend(color.__state, math.hsv_to_rgb(color.__state.h, color.__state.s, color.__state.v));

    } else {

      throw 'Corrupted color state';

    }

  }

  function recalculateHSV(color) {

    var result = math.rgb_to_hsv(color.r, color.g, color.b);

    common.extend(color.__state,
        {
          s: result.s,
          v: result.v
        }
    );

    if (!common.isNaN(result.h)) {
      color.__state.h = result.h;
    } else if (common.isUndefined(color.__state.h)) {
      color.__state.h = 0;
    }

  }

  return Color;

})(dat.color.interpret,
dat.color.math = (function () {

  var tmpComponent;

  return {

    hsv_to_rgb: function(h, s, v) {

      var hi = Math.floor(h / 60) % 6;

      var f = h / 60 - Math.floor(h / 60);
      var p = v * (1.0 - s);
      var q = v * (1.0 - (f * s));
      var t = v * (1.0 - ((1.0 - f) * s));
      var c = [
        [v, t, p],
        [q, v, p],
        [p, v, t],
        [p, q, v],
        [t, p, v],
        [v, p, q]
      ][hi];

      return {
        r: c[0] * 255,
        g: c[1] * 255,
        b: c[2] * 255
      };

    },

    rgb_to_hsv: function(r, g, b) {

      var min = Math.min(r, g, b),
          max = Math.max(r, g, b),
          delta = max - min,
          h, s;

      if (max != 0) {
        s = delta / max;
      } else {
        return {
          h: NaN,
          s: 0,
          v: 0
        };
      }

      if (r == max) {
        h = (g - b) / delta;
      } else if (g == max) {
        h = 2 + (b - r) / delta;
      } else {
        h = 4 + (r - g) / delta;
      }
      h /= 6;
      if (h < 0) {
        h += 1;
      }

      return {
        h: h * 360,
        s: s,
        v: max / 255
      };
    },

    rgb_to_hex: function(r, g, b) {
      var hex = this.hex_with_component(0, 2, r);
      hex = this.hex_with_component(hex, 1, g);
      hex = this.hex_with_component(hex, 0, b);
      return hex;
    },

    component_from_hex: function(hex, componentIndex) {
      return (hex >> (componentIndex * 8)) & 0xFF;
    },

    hex_with_component: function(hex, componentIndex, value) {
      return value << (tmpComponent = componentIndex * 8) | (hex & ~ (0xFF << tmpComponent));
    }

  }

})(),
dat.color.toString,
dat.utils.common),
dat.color.interpret,
dat.utils.common),
dat.utils.requestAnimationFrame = (function () {

  /**
   * requirejs version of Paul Irish's RequestAnimationFrame
   * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
   */

  return window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function(callback, element) {

        window.setTimeout(callback, 1000 / 60);

      };
})(),
dat.dom.CenteredDiv = (function (dom, common) {


  var CenteredDiv = function() {

    this.backgroundElement = document.createElement('div');
    common.extend(this.backgroundElement.style, {
      backgroundColor: 'rgba(0,0,0,0.8)',
      top: 0,
      left: 0,
      display: 'none',
      zIndex: '1000',
      opacity: 0,
      WebkitTransition: 'opacity 0.2s linear'
    });

    dom.makeFullscreen(this.backgroundElement);
    this.backgroundElement.style.position = 'fixed';

    this.domElement = document.createElement('div');
    common.extend(this.domElement.style, {
      position: 'fixed',
      display: 'none',
      zIndex: '1001',
      opacity: 0,
      WebkitTransition: '-webkit-transform 0.2s ease-out, opacity 0.2s linear'
    });


    document.body.appendChild(this.backgroundElement);
    document.body.appendChild(this.domElement);

    var _this = this;
    dom.bind(this.backgroundElement, 'click', function() {
      _this.hide();
    });


  };

  CenteredDiv.prototype.show = function() {

    var _this = this;
    


    this.backgroundElement.style.display = 'block';

    this.domElement.style.display = 'block';
    this.domElement.style.opacity = 0;
//    this.domElement.style.top = '52%';
    this.domElement.style.webkitTransform = 'scale(1.1)';

    this.layout();

    common.defer(function() {
      _this.backgroundElement.style.opacity = 1;
      _this.domElement.style.opacity = 1;
      _this.domElement.style.webkitTransform = 'scale(1)';
    });

  };

  CenteredDiv.prototype.hide = function() {

    var _this = this;

    var hide = function() {

      _this.domElement.style.display = 'none';
      _this.backgroundElement.style.display = 'none';

      dom.unbind(_this.domElement, 'webkitTransitionEnd', hide);
      dom.unbind(_this.domElement, 'transitionend', hide);
      dom.unbind(_this.domElement, 'oTransitionEnd', hide);

    };

    dom.bind(this.domElement, 'webkitTransitionEnd', hide);
    dom.bind(this.domElement, 'transitionend', hide);
    dom.bind(this.domElement, 'oTransitionEnd', hide);

    this.backgroundElement.style.opacity = 0;
//    this.domElement.style.top = '48%';
    this.domElement.style.opacity = 0;
    this.domElement.style.webkitTransform = 'scale(1.1)';

  };

  CenteredDiv.prototype.layout = function() {
    this.domElement.style.left = window.innerWidth/2 - dom.getWidth(this.domElement) / 2 + 'px';
    this.domElement.style.top = window.innerHeight/2 - dom.getHeight(this.domElement) / 2 + 'px';
  };
  
  function lockScroll(e) {
    console.log(e);
  }

  return CenteredDiv;

})(dat.dom.dom,
dat.utils.common),
dat.dom.dom,
dat.utils.common);
},{}],8:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// AudioPlayer.js

var sono = require('./libs/sono/sono');
var NOTES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

var AudioPlayer = function () {
	function AudioPlayer() {
		_classCallCheck(this, AudioPlayer);

		this._isReady = false;
		this._loadAudios();
		this._soundIndex = 0;
		sono.volume = .5;
	}

	_createClass(AudioPlayer, [{
		key: '_loadAudios',
		value: function _loadAudios() {

			this._sounds = [];
			for (var i = 0; i < NOTES.length; i++) {
				var path = ['assets/audio/' + NOTES[i] + '_0.ogg', 'assets/audio/' + NOTES[i] + '_0.mp3'];

				var s = sono.createSound({
					id: 'sound' + i,
					src: path,
					loop: false
				});

				this._sounds.push(s);
			}
		}
	}, {
		key: 'playNextNote',
		value: function playNextNote() {
			this._sounds[this._soundIndex].play();

			var inc = Math.random() > .5 ? 1 : 2;
			this._soundIndex += inc;

			if (this._soundIndex >= NOTES.length) this._soundIndex = 0;
		}
	}]);

	return AudioPlayer;
}();

exports.default = AudioPlayer;

},{"./libs/sono/sono":49}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // Cluster.js

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Cluster = function () {
	function Cluster(position, strength) {
		_classCallCheck(this, Cluster);

		this._position = position;
		this.easing = .05;
		this._strength = new _alfrid2.default.EaseNumber(0, this.easing);
		this._life = new _alfrid2.default.EaseNumber(1, this.easing);
		this._strength.value = strength;
	}

	_createClass(Cluster, [{
		key: 'update',
		value: function update(position, mStrength) {
			// this._position = position;

			this._position[0] += (position[0] - this._position[0]) * this.easing;
			this._position[1] += (position[1] - this._position[1]) * this.easing;
			this._position[2] += (position[2] - this._position[2]) * this.easing;
			this._strength.value = mStrength;
			this._life.value = 1;
		}
	}, {
		key: 'setStrength',
		value: function setStrength(mStrength) {
			this._strength.value = mStrength;
			this._life.value = 0;
		}
	}, {
		key: 'distance',
		value: function distance(position) {
			if (this.isNearDead) {
				return 999;
			}
			var x = position[0] - this._position[0];
			var y = position[1] - this._position[1];
			var z = position[2] - this._position[2];

			return Math.sqrt(x * x + y * y + z * z);
		}
	}, {
		key: 'position',
		get: function get() {
			return this._position;
		}
	}, {
		key: 'strength',
		get: function get() {
			return this._strength.value * this._life.value;
		}
	}, {
		key: 'isNearDead',
		get: function get() {
			return this._life.value < .25;
		}
	}, {
		key: 'isDead',
		get: function get() {
			return this._life.value < .1;
		}
	}]);

	return Cluster;
}();

exports.default = Cluster;

},{"./libs/alfrid.js":20}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Cluster = require('./Cluster');

var _Cluster2 = _interopRequireDefault(_Cluster);

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // ClusterChecker.js


var clusterfck = require("clusterfck");

var MAX_NUM = 600;
var MAX_DISTANCE = 1.0;

var ClusterChecker = function (_alfrid$EventDispatch) {
	_inherits(ClusterChecker, _alfrid$EventDispatch);

	function ClusterChecker(callback) {
		_classCallCheck(this, ClusterChecker);

		var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ClusterChecker).call(this));

		_this._clusters = [];
		_this._maxSize = 0;
		_this._callback = callback;
		return _this;
	}

	_createClass(ClusterChecker, [{
		key: 'check',
		value: function check(pixels) {
			var particles = [];
			var num = params.numParticles * params.numParticles;
			for (var _i = 0; _i < num; _i += 4) {
				particles.push([pixels[_i], pixels[_i + 1], pixels[_i + 2]]);
			}

			var clusters = clusterfck.kmeans(particles, params.numClusters);
			var newClusters = [];

			for (var _i2 = 0; _i2 < clusters.length; _i2++) {
				var cluster = clusters[_i2];
				var center = [0, 0, 0];
				for (var j = 0; j < cluster.length; j++) {
					var p = cluster[j];

					center[0] += p[0];
					center[1] += p[1];
					center[2] += p[2];
				}

				center[0] /= cluster.length;
				center[1] /= cluster.length;
				center[2] /= cluster.length;

				var distances = [];
				for (var _j = 0; _j < this._clusters.length; _j++) {
					var c = this._clusters[_j];
					var d = c.distance(center);
					distances.push(d);
				}

				newClusters.push({
					position: center,
					num: cluster.length,
					distances: distances,
					linkedIndex: -1,
					picked: false
				});

				if (cluster.length > this._maxSize) {
					this._maxSize = cluster.length;
				}
			}

			//	FIRST TIME CREATION

			if (this._clusters.length === 0) {
				for (var _i3 = 0; _i3 < newClusters.length; _i3++) {
					var _cluster = newClusters[_i3];
					var strength = _cluster.num / MAX_NUM;
					var _c = new _Cluster2.default(_cluster.position, strength);

					this._clusters.push(_c);
				}

				return;
			}

			//	CHECK DISTANCES

			var threshold = MAX_DISTANCE;

			var needToCheck = true;
			var minDist = 0.0;
			var ia = void 0,
			    ib = void 0;
			var cnt = 0;

			while (needToCheck) {
				minDist = -1;
				for (var _j2 = 0; _j2 < newClusters.length; _j2++) {
					var _c2 = newClusters[_j2];
					if (!_c2.picked) {
						var _distances = _c2.distances;
						for (var _i4 = 0; _i4 < _distances.length; _i4++) {
							var _d = _distances[_i4];
							if (minDist < 0) {
								minDist = _d;
								ia = _j2;
								ib = _i4;
							} else {
								if (_d < minDist) {
									minDist = _d;

									ia = _j2;
									ib = _i4;
								}
							}
						}
					}
				}

				//	removing
				if (minDist < threshold) {
					newClusters[ia].picked = true;
					newClusters[ia].linkedIndex = ib;
				}

				if (minDist > threshold) {
					needToCheck = false;
				}
				if (minDist < 0) {
					needToCheck = false;
				}

				if (cnt++ > 100) {
					console.debug('Overflow');
					needToCheck = false;
				}
			}

			//	UPDATE CLUSTER / NEW CLUSTER
			var pickedIndices = [];
			var tmp = [];
			for (var _i5 = 0; _i5 < newClusters.length; _i5++) {
				var _cluster2 = newClusters[_i5];
				if (_cluster2.linkedIndex >= 0) {
					this._clusters[_cluster2.linkedIndex].update(_cluster2.position, _cluster2.num / MAX_NUM);
					pickedIndices.push(_i5);
				} else {
					var _c3 = new _Cluster2.default(_cluster2.position, _cluster2.num / MAX_NUM);
					tmp.push(_c3);
				}
			}

			//	FADE CLUSTERS THAT NOT EXIST ANYMORE
			for (var _i6 = 0; _i6 < this._clusters.length; _i6++) {
				if (pickedIndices.indexOf(_i6) < 0) {
					this._clusters[_i6].setStrength(0);
				}
			}

			//	REMOVE CLUSTERS THAT DIED
			var i = this._clusters.length;
			while (i--) {
				if (this._clusters[i].isDead) {
					this._clusters.splice(i, 1);
				}
			}

			this._clusters = this._clusters.concat(tmp);

			if (tmp.length > 0) {
				if (this._callback) {
					this._callback(tmp.length);
				}
			}
		}
	}, {
		key: 'clusters',
		get: function get() {
			return this._clusters;
		}
	}]);

	return ClusterChecker;
}(_alfrid2.default.EventDispatcher);

exports.default = ClusterChecker;

},{"./Cluster":10,"./libs/alfrid.js":20,"clusterfck":1}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

var _ViewSave = require('./ViewSave');

var _ViewSave2 = _interopRequireDefault(_ViewSave);

var _ViewRender = require('./ViewRender');

var _ViewRender2 = _interopRequireDefault(_ViewRender);

var _ViewSimulation = require('./ViewSimulation');

var _ViewSimulation2 = _interopRequireDefault(_ViewSimulation);

var _ViewAddVel = require('./ViewAddVel');

var _ViewAddVel2 = _interopRequireDefault(_ViewAddVel);

var _ViewBall = require('./ViewBall');

var _ViewBall2 = _interopRequireDefault(_ViewBall);

var _ViewPlanes = require('./ViewPlanes');

var _ViewPlanes2 = _interopRequireDefault(_ViewPlanes);

var _ClusterChecker = require('./ClusterChecker');

var _ClusterChecker2 = _interopRequireDefault(_ClusterChecker);

var _AudioPlayer = require('./AudioPlayer');

var _AudioPlayer2 = _interopRequireDefault(_AudioPlayer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // SceneApp.js


var clusterfck = require("clusterfck");

var GL = void 0;

var SceneApp = function (_alfrid$Scene) {
	_inherits(SceneApp, _alfrid$Scene);

	function SceneApp() {
		_classCallCheck(this, SceneApp);

		GL = _alfrid2.default.GL;
		GL.enableAlphaBlending();

		var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SceneApp).call(this));

		_this.orbitalControl._rx.value = 0.3;

		var size = params.numParticles;
		_this.pixels = new Float32Array(4 * size * size);
		_this._clusterChecker = new _ClusterChecker2.default(function (num) {
			return _this._onClusterCreated(num);
		});
		_this._audioPlayer = new _AudioPlayer2.default();
		return _this;
	}

	_createClass(SceneApp, [{
		key: '_initTextures',
		value: function _initTextures() {
			console.log('Init textures');

			//	FBOS
			var numParticles = params.numParticles;
			var o = {
				minFilter: GL.NEAREST,
				magFilter: GL.NEAREST
			};

			function clearFbo(fbo) {
				fbo.bind();
				GL.clear(0, 0, 0, 0);
				fbo.unbind();
			}

			this._fboCurrentPos = new _alfrid2.default.FrameBuffer(numParticles, numParticles, o);
			this._fboTargetPos = new _alfrid2.default.FrameBuffer(numParticles, numParticles, o);
			this._fboCurrentVel = new _alfrid2.default.FrameBuffer(numParticles, numParticles, o);
			this._fboTargetVel = new _alfrid2.default.FrameBuffer(numParticles, numParticles, o);
			this._fboExtra = new _alfrid2.default.FrameBuffer(numParticles, numParticles, o);
			this._fboSpeed = new _alfrid2.default.FrameBuffer(numParticles, numParticles, o);
			this._fboTargetPos.id = 1;

			clearFbo(this._fboCurrentPos);
			clearFbo(this._fboTargetPos);
			clearFbo(this._fboCurrentVel);
			clearFbo(this._fboTargetVel);
			clearFbo(this._fboExtra);
			clearFbo(this._fboSpeed);
		}
	}, {
		key: '_initViews',
		value: function _initViews() {
			console.log('Init Views');
			this._bAxis = new _alfrid2.default.BatchAxis();
			this._bDotsPlane = new _alfrid2.default.BatchDotsPlane();
			this._bCopy = new _alfrid2.default.BatchCopy();

			this._vRender = new _ViewRender2.default();
			this._vSim = new _ViewSimulation2.default();
			this._vAddVel = new _ViewAddVel2.default();
			this._vBall = new _ViewBall2.default();

			//	SAVE INIT POSITIONS
			this._vSave = new _ViewSave2.default();
			GL.setMatrices(this.cameraOrtho);

			this._fboCurrentPos.bind();
			this._vSave.render(0);
			this._fboCurrentPos.unbind();

			this._fboExtra.bind();
			this._vSave.render(1);
			this._fboExtra.unbind();

			this._fboSpeed.bind();
			this._vSave.render(2);
			this._fboSpeed.unbind();

			GL.setMatrices(this.camera);
		}
	}, {
		key: '_onClusterCreated',
		value: function _onClusterCreated(num) {
			for (var i = 0; i < num; i++) {
				// this._audioPlayer.playNextNote();
			}
		}
	}, {
		key: 'updateFbo',
		value: function updateFbo() {
			//	Update Velocity : bind target Velocity, render simulation with current velocity / current position
			this._fboTargetVel.bind();
			GL.clear(0, 0, 0, 1);
			this._vSim.render(this._fboCurrentVel.getTexture(), this._fboCurrentPos.getTexture(), this._fboExtra.getTexture(), this._fboSpeed.getTexture());
			this._fboTargetVel.unbind();

			//	Update position : bind target Position, render addVel with current position / target velocity;
			this._fboTargetPos.bind();
			GL.clear(0, 0, 0, 1);
			this._vAddVel.render(this._fboCurrentPos.getTexture(), this._fboTargetVel.getTexture());
			this._fboTargetPos.unbind();

			//	SWAPPING : PING PONG
			var tmpVel = this._fboCurrentVel;
			this._fboCurrentVel = this._fboTargetVel;
			this._fboTargetVel = tmpVel;

			var tmpPos = this._fboCurrentPos;
			this._fboCurrentPos = this._fboTargetPos;
			this._fboTargetPos = tmpPos;
		}
	}, {
		key: 'render',
		value: function render() {
			var traceTime = false;
			if (traceTime) console.time('read pixels');
			this._readPositions();
			if (traceTime) console.timeEnd('read pixels');
			if (traceTime) console.time('rendering');
			this._doRender();
			if (traceTime) console.timeEnd('rendering');
			if (traceTime) console.time('clustering');
			this._clustering();
			if (traceTime) console.timeEnd('clustering');
		}
	}, {
		key: '_clustering',
		value: function _clustering() {

			this._clusterChecker.check(this.pixels);
			if (params.showCenteroid) {
				for (var i = 0; i < this._clusterChecker.clusters.length; i++) {
					var cluster = this._clusterChecker.clusters[i];
					this._vBall.render(cluster.position, .0 + cluster.strength * 2.0, [1, 0, 0]);
				}
			}
		}
	}, {
		key: '_readPositions',
		value: function _readPositions() {
			var size = this._fboCurrentPos.width;
			var gl = GL.gl;
			this._fboCurrentPos.bind();
			gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, this.pixels);
			this._fboCurrentPos.unbind();
		}
	}, {
		key: '_doRender',
		value: function _doRender() {
			this.updateFbo();

			// this.orbitalControl._ry.value += -.003;

			if (params.showWires && 0) {
				this._bAxis.draw();
				this._bDotsPlane.draw();
			}

			this._vRender.render(this._fboCurrentPos.getTexture(), this._fboExtra.getTexture());

			var debugSize = 256 / 2;

			/*
   GL.viewport(0, 0, debugSize, debugSize);
   this._bCopy.draw(this._fboCurrentPos.getTexture());
   	GL.viewport(debugSize, 0, debugSize, debugSize);
   this._bCopy.draw(this._fboTargetVel.getTexture());
   	GL.viewport(debugSize*2, 0, debugSize, debugSize);
   this._bCopy.draw(this._fboExtra.getTexture());
   	GL.viewport(debugSize*3, 0, debugSize, debugSize);
   this._bCopy.draw(this._fboSpeed.getTexture());
   */
		}
	}]);

	return SceneApp;
}(_alfrid2.default.Scene);

exports.default = SceneApp;

},{"./AudioPlayer":9,"./ClusterChecker":11,"./ViewAddVel":13,"./ViewBall":14,"./ViewPlanes":15,"./ViewRender":16,"./ViewSave":17,"./ViewSimulation":18,"./libs/alfrid.js":20,"clusterfck":1}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // ViewAddVel.js

var GL = _alfrid2.default.GL;


var ViewAddVel = function (_alfrid$View) {
	_inherits(ViewAddVel, _alfrid$View);

	function ViewAddVel() {
		_classCallCheck(this, ViewAddVel);

		return _possibleConstructorReturn(this, Object.getPrototypeOf(ViewAddVel).call(this, _alfrid2.default.ShaderLibs.bigTriangleVert, "// addvel.frag\n\n#define SHADER_NAME SIMPLE_TEXTURE\n\nprecision highp float;\n#define GLSLIFY 1\nvarying vec2 vTextureCoord;\nuniform sampler2D texturePos;\nuniform sampler2D textureVel;\n\nvoid main(void) {\n\tvec3 pos = texture2D(texturePos, vTextureCoord).rgb;\n\tvec3 vel = texture2D(textureVel, vTextureCoord).rgb;\n\n    gl_FragColor = vec4(pos + vel, 1.0);\n}"));
	}

	_createClass(ViewAddVel, [{
		key: '_init',
		value: function _init() {
			this.mesh = _alfrid2.default.Geom.bigTriangle();
		}
	}, {
		key: 'render',
		value: function render(texturePos, textureVel) {
			this.shader.bind();

			this.shader.uniform("texturePos", "uniform1i", 0);
			texturePos.bind(0);

			this.shader.uniform("textureVel", "uniform1i", 1);
			textureVel.bind(1);

			GL.draw(this.mesh);
		}
	}]);

	return ViewAddVel;
}(_alfrid2.default.View);

exports.default = ViewAddVel;

},{"./libs/alfrid.js":20}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // ViewBall.js

var GL = _alfrid2.default.GL;


var ViewBall = function (_alfrid$View) {
	_inherits(ViewBall, _alfrid$View);

	function ViewBall() {
		_classCallCheck(this, ViewBall);

		return _possibleConstructorReturn(this, Object.getPrototypeOf(ViewBall).call(this, _alfrid2.default.ShaderLibs.generalNormalVert, "// sphere.frag\n\n#define SHADER_NAME SIMPLE_TEXTURE\n\nprecision highp float;\n#define GLSLIFY 1\nvarying vec2 vTextureCoord;\nvarying vec3 vNormal;\nuniform mat3 uNormalMatrix;\n\nfloat diffuse(vec3 N, vec3 L) {\n\treturn max(dot(N, normalize(L)), 0.0);\n}\n\nvec3 diffuse(vec3 N, vec3 L, vec3 C) {\n\treturn diffuse(N, L) * C;\n}\n\nconst float fade = 0.95;\nconst vec3 L0 = vec3(1.0, 1.0, 1.0);\nconst vec3 L1 = vec3(-1.0, -.5, 1.0);\nconst vec3 LC0 = vec3(1.0, 1.0, fade);\nconst vec3 LC1 = vec3(fade, fade, 1.0);\n\nvoid main(void) {\n    vec3 d0 = diffuse(vNormal, L0, LC0) * .5;\n    vec3 d1 = diffuse(vNormal, L1, LC1) * .5;\n\n    vec3 color = .3 + d0 + d1;\n    gl_FragColor = vec4(color * vec3(1.0, .95, .9), 1.0);\n\n}"));
	}

	_createClass(ViewBall, [{
		key: '_init',
		value: function _init() {
			this.mesh = _alfrid2.default.Geom.sphere(.24, 32, true);
			this.meshWires = _alfrid2.default.Geom.sphere(.24, 8, true, false, GL.LINES);
		}
	}, {
		key: 'render',
		value: function render() {
			var pos = arguments.length <= 0 || arguments[0] === undefined ? [0, 0, 0] : arguments[0];
			var scale = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
			var color = arguments.length <= 2 || arguments[2] === undefined ? [1, 0, 0] : arguments[2];
			var opacity = arguments.length <= 3 || arguments[3] === undefined ? 1 : arguments[3];

			this.shader.bind();
			this.shader.uniform("position", "uniform3fv", pos);
			this.shader.uniform("scale", "uniform3fv", [scale, scale, scale]);
			this.shader.uniform("color", "uniform3fv", color);
			this.shader.uniform("opacity", "uniform1f", opacity);
			GL.draw(params.showWires ? this.meshWires : this.mesh);
		}
	}]);

	return ViewBall;
}(_alfrid2.default.View);

exports.default = ViewBall;

},{"./libs/alfrid.js":20}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // ViewPlanes.js

var GL = _alfrid2.default.GL;


var ViewPlanes = function (_alfrid$View) {
	_inherits(ViewPlanes, _alfrid$View);

	function ViewPlanes() {
		_classCallCheck(this, ViewPlanes);

		return _possibleConstructorReturn(this, Object.getPrototypeOf(ViewPlanes).call(this, "// planes.vert\n\n/*\nprecision highp float;\nattribute vec3 aVertexPosition;\nattribute vec3 aFlipPosition;\nattribute vec2 aTextureCoord;\nattribute vec3 aNormal;\nattribute vec3 aExtra;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\nuniform mat4 uShadowMatrix;\nuniform sampler2D texture;\nuniform sampler2D textureNext;\nuniform float percent;\nuniform float flip;\nuniform float uvIndex;\nuniform float numSlides;\n\nvarying vec3 vNormal;\nvarying vec3 vVertex;\nvarying vec3 vExtra;\nvarying float vDepth;\nvarying vec4 vShadowCoord;\n\nconst mat4 biasMatrix = mat4( 0.5, 0.0, 0.0, 0.0,\n\t\t\t\t\t\t\t  0.0, 0.5, 0.0, 0.0,\n\t\t\t\t\t\t\t  0.0, 0.0, 0.5, 0.0,\n\t\t\t\t\t\t\t  0.5, 0.5, 0.5, 1.0 );\n\nvoid main(void) {\n\tvec2 uv         = aTextureCoord * .5;\n\t\n\tuv              *= .5;\t\t\n\tfloat uvSize    = .5/numSlides;\n\tfloat tx        = mod(uvIndex, numSlides) * uvSize;\n\tfloat ty        = floor(uvIndex / numSlides) * uvSize;\n\tuv              += vec2(tx, ty);\n\tvec3 currPos    = texture2D(texture, uv).rgb;\n\tvec3 nextPos    = texture2D(textureNext, uv).rgb;\n\tvec3 pos        = mix(currPos, nextPos, percent);\n\n\n\tvShadowCoord    = ( biasMatrix * uShadowMatrix ) * vec4(pos, 1.0);\n\t\n\tvec4 mvPosition = uViewMatrix * uModelMatrix * vec4(pos, 1.0);\n\tfloat scale     = .04;\n\tmvPosition.xyz  += mix(aVertexPosition, aFlipPosition, flip) * scale;\n\tvec4 V          = uProjectionMatrix * mvPosition;\n\tgl_Position     = V;\n\t\n\t\n\tvNormal         = aNormal;\n\tvVertex         = pos;\n\tvExtra          = aExtra;\n\t\n\tvDepth          = V.z/V.w;\n}\n\n\n*/\n\nprecision highp float;\n#define GLSLIFY 1\nattribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\n\nvarying vec2 vTextureCoord;\n\nvoid main(void) {\n    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);\n    vTextureCoord = aTextureCoord;\n}", "// planes.frag\n\n#define SHADER_NAME SIMPLE_TEXTURE\n\nprecision highp float;\n#define GLSLIFY 1\n\nuniform mat3 uNormalMatrix;\nvarying vec3 vNormal;\nvarying vec3 vVertex;\nvarying vec3 vExtra;\nvarying float vDepth;\n\nfloat diffuse(vec3 N, vec3 L) {\n\treturn max(dot(N, normalize(L)), .0);\n}\n\nconst vec3 LIGHT = vec3(0.0, 1.0, 1.0);\n\nvoid main(void) {\n\tvec3 N = uNormalMatrix * normalize(vVertex + vExtra);\n\tfloat _diffuse = diffuse(N, LIGHT);\n\t_diffuse = mix(_diffuse, 1.0, 0.3);\n\n    gl_FragColor = vec4(vec3(_diffuse), 1.0);\n\n    gl_FragColor = vec4(vec3(vDepth), 1.0);\n}"));
	}

	_createClass(ViewPlanes, [{
		key: '_init',
		value: function _init() {

			var num = params.numParticles;
			var positions = [];
			var coords = [];
			var indices = [];
			var count = 0;
			var size = .02;

			for (var j = 0; j < num; j++) {
				for (var i = 0; i < num; i++) {
					positions.push([-size, size, 0]);
					positions.push([size, size, 0]);
					positions.push([size, -size, 0]);
					positions.push([-size, -size, 0]);

					coords.push([i / num, j / num]);
					coords.push([i / num, j / num]);
					coords.push([i / num, j / num]);
					coords.push([i / num, j / num]);

					indices.push(count * 4 + 0);
					indices.push(count * 4 + 1);
					indices.push(count * 4 + 2);
					indices.push(count * 4 + 0);
					indices.push(count * 4 + 2);
					indices.push(count * 4 + 3);

					count++;
				}
			}

			this.mesh;
		}
	}, {
		key: 'render',
		value: function render(texture) {
			this.shader.bind();
			this.shader.uniform("texture", "uniform1i", 0);
			texture.bind(0);
			GL.draw(this.mesh);
		}
	}]);

	return ViewPlanes;
}(_alfrid2.default.View);

exports.default = ViewPlanes;

},{"./libs/alfrid.js":20}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // ViewRender.js



var GL = void 0;

var ViewRender = function (_alfrid$View) {
	_inherits(ViewRender, _alfrid$View);

	function ViewRender() {
		_classCallCheck(this, ViewRender);

		GL = _alfrid2.default.GL;
		return _possibleConstructorReturn(this, Object.getPrototypeOf(ViewRender).call(this, "// render.vert\n\nprecision highp float;\n#define GLSLIFY 1\nattribute vec3 aVertexPosition;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\nuniform sampler2D texture;\nuniform sampler2D textureExtra;\nvarying vec4 vColor;\n\nvoid main(void) {\n\tvec2 uv      = aVertexPosition.xy;\n\tvec3 pos     = texture2D(texture, uv).rgb;\n\tvec3 extra   = texture2D(textureExtra, uv).rgb;\n\tgl_Position  = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);\n\t\n\tgl_PointSize = 1.0 + extra.r * 2.0;\n\t\n\tvColor \t\t= vec4(vec3(extra.b), 1.0);\n}", "// render.frag\n\n// save.frag\n\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec4 vColor;\n\nvoid main(void) {\n\tif(vColor.a <= 0.01) {\n\t\tdiscard;\n\t}\n    gl_FragColor = vColor;\n}"));
	}

	_createClass(ViewRender, [{
		key: '_init',
		value: function _init() {
			var positions = [];
			var coords = [];
			var indices = [];
			var count = 0;
			var numParticles = params.numParticles;
			var ux = void 0,
			    uy = void 0;

			for (var j = 0; j < numParticles; j++) {
				for (var i = 0; i < numParticles; i++) {
					ux = i / numParticles;
					uy = j / numParticles;
					positions.push([ux, uy, 0]);
					indices.push(count);
					count++;
				}
			}

			this.mesh = new _alfrid2.default.Mesh(GL.POINTS);
			this.mesh.bufferVertex(positions);
			this.mesh.bufferIndices(indices);
		}
	}, {
		key: 'render',
		value: function render(texture, textureExtra) {
			this.shader.bind();
			this.shader.uniform("texture", "uniform1i", 0);
			texture.bind(0);

			this.shader.uniform("textureExtra", "uniform1i", 1);
			textureExtra.bind(1);
			GL.draw(this.mesh);
		}
	}]);

	return ViewRender;
}(_alfrid2.default.View);

exports.default = ViewRender;

},{"./libs/alfrid.js":20}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // ViewSave.js



var random = function random(min, max) {
	return min + Math.random() * (max - min);
};

var GL = void 0;

var ViewSave = function (_alfrid$View) {
	_inherits(ViewSave, _alfrid$View);

	function ViewSave() {
		_classCallCheck(this, ViewSave);

		GL = _alfrid2.default.GL;

		return _possibleConstructorReturn(this, Object.getPrototypeOf(ViewSave).call(this, "// save.vert\n\nprecision highp float;\n#define GLSLIFY 1\nattribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\n\nvarying vec2 vTextureCoord;\nvarying vec3 vColor;\n\nvoid main(void) {\n\tvColor      = aVertexPosition;\n\tvec3 pos    = vec3(aTextureCoord, 0.0);\n\tgl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);\n\n    gl_PointSize = 1.0;\n}", "// save.frag\n\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec3 vColor;\n\nvoid main(void) {\n    gl_FragColor = vec4(vColor, 1.0);\n}"));
	}

	_createClass(ViewSave, [{
		key: '_init',
		value: function _init() {
			//	SAVE FOR POSITION
			//	SAVE FOR RANDOM

			var positions = [];
			var coords = [];
			var indices = [];
			var extras = [];
			var speedLimit = [];
			var count = 0;

			var numParticles = params.numParticles;
			var totalParticles = numParticles * numParticles;
			var ux = void 0,
			    uy = void 0;
			var range = 3.5;
			var speedScale = .0007;

			for (var j = 0; j < numParticles; j++) {
				for (var i = 0; i < numParticles; i++) {
					positions.push([random(-range, range), random(-range, range), random(-range, range)]);

					ux = i / numParticles * 2.0 - 1.0;
					uy = j / numParticles * 2.0 - 1.0;

					extras.push([Math.random(), Math.random(), Math.random()]);
					speedLimit.push([random(1, 3) * speedScale, random(5, 18) * speedScale, 0.0]);
					coords.push([ux, uy]);
					indices.push(count);
					count++;
				}
			}

			this.mesh = new _alfrid2.default.Mesh(GL.POINTS);
			this.mesh.bufferVertex(positions);
			this.mesh.bufferTexCoords(coords);
			this.mesh.bufferIndices(indices);

			this.meshExtra = new _alfrid2.default.Mesh(GL.POINTS);
			this.meshExtra.bufferVertex(extras);
			this.meshExtra.bufferTexCoords(coords);
			this.meshExtra.bufferIndices(indices);

			this.meshSpeed = new _alfrid2.default.Mesh(GL.POINTS);
			this.meshSpeed.bufferVertex(speedLimit);
			this.meshSpeed.bufferTexCoords(coords);
			this.meshSpeed.bufferIndices(indices);
		}
	}, {
		key: 'render',
		value: function render() {
			var state = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];


			this.shader.bind();
			if (state == 0) {
				GL.draw(this.mesh);
			} else if (state == 1) {
				GL.draw(this.meshExtra);
			} else {
				GL.draw(this.meshSpeed);
			}
		}
	}]);

	return ViewSave;
}(_alfrid2.default.View);

exports.default = ViewSave;

},{"./libs/alfrid.js":20}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } // ViewSimulation.js



var GL = _alfrid2.default.GL;

var ViewSimulation = function (_alfrid$View) {
	_inherits(ViewSimulation, _alfrid$View);

	function ViewSimulation() {
		_classCallCheck(this, ViewSimulation);

		var fs = "// sim.frag\n\n#define SHADER_NAME SIMPLE_TEXTURE\n\nprecision highp float;\n#define GLSLIFY 1\nvarying vec2 vTextureCoord;\nuniform sampler2D textureVel;\nuniform sampler2D texturePos;\nuniform sampler2D textureExtra;\nuniform sampler2D textureSpeed;\nuniform float time;\n\nconst float NUM = {{NUM_PARTICLES}};\nconst float PI = 3.1415926;\nconst float PI_2 = 3.1415926*2.0;\n\nfloat map(float value, float sx, float sy, float tx, float ty) {\n\tfloat p = (value - sx) / (sy - sx);\n\tp = clamp(p, 0.0, 1.0);\n\treturn tx + (ty - tx) * p;\n}\n\nvoid main(void) {\n\tvec3 pos        = texture2D(texturePos, vTextureCoord).rgb;\n\tvec3 vel        = texture2D(textureVel, vTextureCoord).rgb;\n\tvec3 extra      = texture2D(textureExtra, vTextureCoord).rgb;\n\tvec3 speeds      = texture2D(textureSpeed, vTextureCoord).rgb;\n\n\tvec2 uvParticles;\n\tvec3 posParticle, velParticle;\n\tfloat percent;\n\tvec3 dirToParticle;\n\tfloat f, delta, forceApply;\n\n\tfloat RANGE = .65 * mix(extra.x, 1.0, .5);\n\tfloat forceOffset = mix(extra.y, 1.0, .5);\n\tconst float minThreshold    = 0.4;\n\tconst float maxThreshold    = 0.7;\n\n\tconst float speedScale      = 0.15;\n\tconst float repelStrength   = 0.04 * speedScale;\n\tconst float attractStrength = 0.0002 * speedScale;\n\tconst float orientStrength  = 0.02 * speedScale;\n\n\tfor(float y=0.0; y<NUM; y++) {\n\t\tfor(float x=0.0; x<NUM; x++) {\n\t\t\tif(x <= y) continue;\n\n\t\t\tuvParticles = vec2(x, y)/NUM;\n\t\t\tposParticle = texture2D(texturePos, uvParticles).rgb;\n\t\t\tpercent = distance(pos, posParticle) / RANGE;\n\t\t\tforceApply = 1.0 - step(1.0, percent);\n\t\t\tforceApply *= forceOffset;\n\t\t\tdirToParticle = normalize(posParticle - pos);\n\n\t\t\tif(percent < minThreshold) {\n\t\t\t\tf = (minThreshold/percent - 1.0) * repelStrength;\n\t\t\t\tvel -= f * dirToParticle * forceApply;\n\t\t\t} else if(percent < maxThreshold) {\n\t\t\t\tvelParticle = texture2D(textureVel, uvParticles).rgb;\n\t\t\t\tdelta = map(percent, minThreshold, maxThreshold, 0.0, 1.0);\n\t\t\t\tvec3 avgDir = (vel + velParticle) * .5;\n\t\t\t\tif(length(avgDir) > 0.0) {\n\t\t\t\t\tavgDir = normalize(avgDir);\n\t\t\t\t\tf = ( 1.0 - cos( delta * PI_2 ) * 0.5 + 0.5 );\n\t\t\t\t\tvel += avgDir * f * orientStrength * forceApply;\n\t\t\t\t}\n\t\t\t} else {\n\t\t\t\tdelta = map(percent, maxThreshold, 1.0, 0.0, 1.0);\n\t\t\t\tf = ( 1.0 - cos( delta * PI_2 ) * -0.5 + 0.5 );\n\t\t\t\tvel += dirToParticle * f * attractStrength * forceApply;\n\t\t\t}\n\n\t\t}\n\n\t}\n\n\tconst float maxRadius = 3.0;\n\tconst float minRadius = 1.25;\n\tfloat dist = length(pos);\n\tif(dist > maxRadius) {\n\t\tfloat f = (dist - maxRadius) * .005;\n\t\tvel -= normalize(pos) * f * forceOffset;\n\t}\n\n\tif(dist < minRadius) {\n\t\tfloat f = (1.0-dist/minRadius) * 1.0;\n\t\tvel += normalize(pos) * f * forceOffset;\n\t}\n\n\tvec3 velDir = normalize(vel);\n\tfloat speed = length(vel);\n\tif(speed < speeds.x) {\t\t//\tmin speed\n\t\tvel = velDir * speeds.x;\n\t} \n\n\tif(speed > speeds.y) {\t\t//\tmax speed;\n\t\tvel = velDir * speeds.y;\n\t}\n\n\tgl_FragColor = vec4(vel, 1.0);\n}";
		fs = fs.replace('{{NUM_PARTICLES}}', params.numParticles.toFixed(1));

		var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ViewSimulation).call(this, _alfrid2.default.ShaderLibs.bigTriangleVert, fs));

		_this.time = Math.random() * 0xFF;

		return _this;
	}

	_createClass(ViewSimulation, [{
		key: '_init',
		value: function _init() {
			console.log('init');

			this.mesh = _alfrid2.default.Geom.bigTriangle();
		}
	}, {
		key: 'render',
		value: function render(textureVel, texturePos, textureExtra, textureSpeed) {
			this.time += .01;
			this.shader.bind();
			this.shader.uniform("textureVel", "uniform1i", 0);
			textureVel.bind(0);
			this.shader.uniform("texturePos", "uniform1i", 1);
			texturePos.bind(1);
			this.shader.uniform("textureExtra", "uniform1i", 2);
			textureExtra.bind(2);
			this.shader.uniform("textureSpeed", "uniform1i", 3);
			textureSpeed.bind(3);

			this.shader.uniform("time", "uniform1f", this.time);

			GL.draw(this.mesh);
		}
	}]);

	return ViewSimulation;
}(_alfrid2.default.View);

exports.default = ViewSimulation;

},{"./libs/alfrid.js":20}],19:[function(require,module,exports){
'use strict';

var _alfrid = require('./libs/alfrid.js');

var _alfrid2 = _interopRequireDefault(_alfrid);

var _SceneApp = require('./SceneApp');

var _SceneApp2 = _interopRequireDefault(_SceneApp);

var _datGui = require('dat-gui');

var _datGui2 = _interopRequireDefault(_datGui);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.params = {
	numParticles: 64,
	skipCount: 5,
	shadowStrength: .35,
	shadowThreshold: .55,
	numSlides: 2 * 2,
	numClusters: 7,
	showCenteroid: true,
	showWires: false
};

if (document.body) {
	_init();
} else {
	window.addEventListener('load', function () {
		return _init();
	});
}

function _init() {
	console.debug('Total Particles :', params.numParticles * params.numParticles);

	//	CREATE CANVAS
	var canvas = document.createElement("canvas");
	canvas.className = 'Main-Canvas';
	document.body.appendChild(canvas);

	//	INIT GL TOOL
	_alfrid2.default.GL.init(canvas);

	//	INIT SCENE
	var scene = new _SceneApp2.default();

	var gui = new _datGui2.default.GUI({ width: 300 });
	gui.add(params, 'numClusters', 3, 20).step(1);
	gui.add(params, 'showCenteroid');

	window.addEventListener('keydown', function (e) {
		if (e.keyCode == 87) {
			params.showWires = !params.showWires;
		}
	});
}

},{"./SceneApp":12,"./libs/alfrid.js":20,"dat-gui":5}],20:[function(require,module,exports){
(function (global){
"use strict";var _typeof=typeof Symbol==="function"&&typeof Symbol.iterator==="symbol"?function(obj){return typeof obj;}:function(obj){return obj&&typeof Symbol==="function"&&obj.constructor===Symbol?"symbol":typeof obj;};(function(f){if((typeof exports==="undefined"?"undefined":_typeof(exports))==="object"&&typeof module!=="undefined"){module.exports=f();}else if(typeof define==="function"&&define.amd){define([],f);}else {var g;if(typeof window!=="undefined"){g=window;}else if(typeof global!=="undefined"){g=global;}else if(typeof self!=="undefined"){g=self;}else {g=this;}g.alfrid=f();}})(function(){var define,module,exports;return function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f;}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e);},l,l.exports,e,t,n,r);}return n[o].exports;}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++){s(r[o]);}return s;}({1:[function(_dereq_,module,exports){ /**
 * @fileoverview gl-matrix - High performance matrix and vector operations
 * @author Brandon Jones
 * @author Colin MacKenzie IV
 * @version 2.3.0
 */ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */ // END HEADER
exports.glMatrix=_dereq_("./gl-matrix/common.js");exports.mat2=_dereq_("./gl-matrix/mat2.js");exports.mat2d=_dereq_("./gl-matrix/mat2d.js");exports.mat3=_dereq_("./gl-matrix/mat3.js");exports.mat4=_dereq_("./gl-matrix/mat4.js");exports.quat=_dereq_("./gl-matrix/quat.js");exports.vec2=_dereq_("./gl-matrix/vec2.js");exports.vec3=_dereq_("./gl-matrix/vec3.js");exports.vec4=_dereq_("./gl-matrix/vec4.js");},{"./gl-matrix/common.js":2,"./gl-matrix/mat2.js":3,"./gl-matrix/mat2d.js":4,"./gl-matrix/mat3.js":5,"./gl-matrix/mat4.js":6,"./gl-matrix/quat.js":7,"./gl-matrix/vec2.js":8,"./gl-matrix/vec3.js":9,"./gl-matrix/vec4.js":10}],2:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */ /**
 * @class Common utilities
 * @name glMatrix
 */var glMatrix={}; // Constants
glMatrix.EPSILON=0.000001;glMatrix.ARRAY_TYPE=typeof Float32Array!=='undefined'?Float32Array:Array;glMatrix.RANDOM=Math.random; /**
 * Sets the type of array used when creating new vectors and matrices
 *
 * @param {Type} type Array type, such as Float32Array or Array
 */glMatrix.setMatrixArrayType=function(type){GLMAT_ARRAY_TYPE=type;};var degree=Math.PI/180; /**
* Convert Degree To Radian
*
* @param {Number} Angle in Degrees
*/glMatrix.toRadian=function(a){return a*degree;};module.exports=glMatrix;},{}],3:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */var glMatrix=_dereq_("./common.js"); /**
 * @class 2x2 Matrix
 * @name mat2
 */var mat2={}; /**
 * Creates a new identity mat2
 *
 * @returns {mat2} a new 2x2 matrix
 */mat2.create=function(){var out=new glMatrix.ARRAY_TYPE(4);out[0]=1;out[1]=0;out[2]=0;out[3]=1;return out;}; /**
 * Creates a new mat2 initialized with values from an existing matrix
 *
 * @param {mat2} a matrix to clone
 * @returns {mat2} a new 2x2 matrix
 */mat2.clone=function(a){var out=new glMatrix.ARRAY_TYPE(4);out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];return out;}; /**
 * Copy the values from one mat2 to another
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */mat2.copy=function(out,a){out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];return out;}; /**
 * Set a mat2 to the identity matrix
 *
 * @param {mat2} out the receiving matrix
 * @returns {mat2} out
 */mat2.identity=function(out){out[0]=1;out[1]=0;out[2]=0;out[3]=1;return out;}; /**
 * Transpose the values of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */mat2.transpose=function(out,a){ // If we are transposing ourselves we can skip a few steps but have to cache some values
if(out===a){var a1=a[1];out[1]=a[2];out[2]=a1;}else {out[0]=a[0];out[1]=a[2];out[2]=a[1];out[3]=a[3];}return out;}; /**
 * Inverts a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */mat2.invert=function(out,a){var a0=a[0],a1=a[1],a2=a[2],a3=a[3], // Calculate the determinant
det=a0*a3-a2*a1;if(!det){return null;}det=1.0/det;out[0]=a3*det;out[1]=-a1*det;out[2]=-a2*det;out[3]=a0*det;return out;}; /**
 * Calculates the adjugate of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */mat2.adjoint=function(out,a){ // Caching this value is nessecary if out == a
var a0=a[0];out[0]=a[3];out[1]=-a[1];out[2]=-a[2];out[3]=a0;return out;}; /**
 * Calculates the determinant of a mat2
 *
 * @param {mat2} a the source matrix
 * @returns {Number} determinant of a
 */mat2.determinant=function(a){return a[0]*a[3]-a[2]*a[1];}; /**
 * Multiplies two mat2's
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the first operand
 * @param {mat2} b the second operand
 * @returns {mat2} out
 */mat2.multiply=function(out,a,b){var a0=a[0],a1=a[1],a2=a[2],a3=a[3];var b0=b[0],b1=b[1],b2=b[2],b3=b[3];out[0]=a0*b0+a2*b1;out[1]=a1*b0+a3*b1;out[2]=a0*b2+a2*b3;out[3]=a1*b2+a3*b3;return out;}; /**
 * Alias for {@link mat2.multiply}
 * @function
 */mat2.mul=mat2.multiply; /**
 * Rotates a mat2 by the given angle
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2} out
 */mat2.rotate=function(out,a,rad){var a0=a[0],a1=a[1],a2=a[2],a3=a[3],s=Math.sin(rad),c=Math.cos(rad);out[0]=a0*c+a2*s;out[1]=a1*c+a3*s;out[2]=a0*-s+a2*c;out[3]=a1*-s+a3*c;return out;}; /**
 * Scales the mat2 by the dimensions in the given vec2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the matrix to rotate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat2} out
 **/mat2.scale=function(out,a,v){var a0=a[0],a1=a[1],a2=a[2],a3=a[3],v0=v[0],v1=v[1];out[0]=a0*v0;out[1]=a1*v0;out[2]=a2*v1;out[3]=a3*v1;return out;}; /**
 * Creates a matrix from a given angle
 * This is equivalent to (but much faster than):
 *
 *     mat2.identity(dest);
 *     mat2.rotate(dest, dest, rad);
 *
 * @param {mat2} out mat2 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2} out
 */mat2.fromRotation=function(out,rad){var s=Math.sin(rad),c=Math.cos(rad);out[0]=c;out[1]=s;out[2]=-s;out[3]=c;return out;}; /**
 * Creates a matrix from a vector scaling
 * This is equivalent to (but much faster than):
 *
 *     mat2.identity(dest);
 *     mat2.scale(dest, dest, vec);
 *
 * @param {mat2} out mat2 receiving operation result
 * @param {vec2} v Scaling vector
 * @returns {mat2} out
 */mat2.fromScaling=function(out,v){out[0]=v[0];out[1]=0;out[2]=0;out[3]=v[1];return out;}; /**
 * Returns a string representation of a mat2
 *
 * @param {mat2} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */mat2.str=function(a){return 'mat2('+a[0]+', '+a[1]+', '+a[2]+', '+a[3]+')';}; /**
 * Returns Frobenius norm of a mat2
 *
 * @param {mat2} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */mat2.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2));}; /**
 * Returns L, D and U matrices (Lower triangular, Diagonal and Upper triangular) by factorizing the input matrix
 * @param {mat2} L the lower triangular matrix 
 * @param {mat2} D the diagonal matrix 
 * @param {mat2} U the upper triangular matrix 
 * @param {mat2} a the input matrix to factorize
 */mat2.LDU=function(L,D,U,a){L[2]=a[2]/a[0];U[0]=a[0];U[1]=a[1];U[3]=a[3]-L[2]*U[1];return [L,D,U];};module.exports=mat2;},{"./common.js":2}],4:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */var glMatrix=_dereq_("./common.js"); /**
 * @class 2x3 Matrix
 * @name mat2d
 * 
 * @description 
 * A mat2d contains six elements defined as:
 * <pre>
 * [a, c, tx,
 *  b, d, ty]
 * </pre>
 * This is a short form for the 3x3 matrix:
 * <pre>
 * [a, c, tx,
 *  b, d, ty,
 *  0, 0, 1]
 * </pre>
 * The last row is ignored so the array is shorter and operations are faster.
 */var mat2d={}; /**
 * Creates a new identity mat2d
 *
 * @returns {mat2d} a new 2x3 matrix
 */mat2d.create=function(){var out=new glMatrix.ARRAY_TYPE(6);out[0]=1;out[1]=0;out[2]=0;out[3]=1;out[4]=0;out[5]=0;return out;}; /**
 * Creates a new mat2d initialized with values from an existing matrix
 *
 * @param {mat2d} a matrix to clone
 * @returns {mat2d} a new 2x3 matrix
 */mat2d.clone=function(a){var out=new glMatrix.ARRAY_TYPE(6);out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];out[4]=a[4];out[5]=a[5];return out;}; /**
 * Copy the values from one mat2d to another
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the source matrix
 * @returns {mat2d} out
 */mat2d.copy=function(out,a){out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];out[4]=a[4];out[5]=a[5];return out;}; /**
 * Set a mat2d to the identity matrix
 *
 * @param {mat2d} out the receiving matrix
 * @returns {mat2d} out
 */mat2d.identity=function(out){out[0]=1;out[1]=0;out[2]=0;out[3]=1;out[4]=0;out[5]=0;return out;}; /**
 * Inverts a mat2d
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the source matrix
 * @returns {mat2d} out
 */mat2d.invert=function(out,a){var aa=a[0],ab=a[1],ac=a[2],ad=a[3],atx=a[4],aty=a[5];var det=aa*ad-ab*ac;if(!det){return null;}det=1.0/det;out[0]=ad*det;out[1]=-ab*det;out[2]=-ac*det;out[3]=aa*det;out[4]=(ac*aty-ad*atx)*det;out[5]=(ab*atx-aa*aty)*det;return out;}; /**
 * Calculates the determinant of a mat2d
 *
 * @param {mat2d} a the source matrix
 * @returns {Number} determinant of a
 */mat2d.determinant=function(a){return a[0]*a[3]-a[1]*a[2];}; /**
 * Multiplies two mat2d's
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the first operand
 * @param {mat2d} b the second operand
 * @returns {mat2d} out
 */mat2d.multiply=function(out,a,b){var a0=a[0],a1=a[1],a2=a[2],a3=a[3],a4=a[4],a5=a[5],b0=b[0],b1=b[1],b2=b[2],b3=b[3],b4=b[4],b5=b[5];out[0]=a0*b0+a2*b1;out[1]=a1*b0+a3*b1;out[2]=a0*b2+a2*b3;out[3]=a1*b2+a3*b3;out[4]=a0*b4+a2*b5+a4;out[5]=a1*b4+a3*b5+a5;return out;}; /**
 * Alias for {@link mat2d.multiply}
 * @function
 */mat2d.mul=mat2d.multiply; /**
 * Rotates a mat2d by the given angle
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2d} out
 */mat2d.rotate=function(out,a,rad){var a0=a[0],a1=a[1],a2=a[2],a3=a[3],a4=a[4],a5=a[5],s=Math.sin(rad),c=Math.cos(rad);out[0]=a0*c+a2*s;out[1]=a1*c+a3*s;out[2]=a0*-s+a2*c;out[3]=a1*-s+a3*c;out[4]=a4;out[5]=a5;return out;}; /**
 * Scales the mat2d by the dimensions in the given vec2
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to translate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat2d} out
 **/mat2d.scale=function(out,a,v){var a0=a[0],a1=a[1],a2=a[2],a3=a[3],a4=a[4],a5=a[5],v0=v[0],v1=v[1];out[0]=a0*v0;out[1]=a1*v0;out[2]=a2*v1;out[3]=a3*v1;out[4]=a4;out[5]=a5;return out;}; /**
 * Translates the mat2d by the dimensions in the given vec2
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to translate
 * @param {vec2} v the vec2 to translate the matrix by
 * @returns {mat2d} out
 **/mat2d.translate=function(out,a,v){var a0=a[0],a1=a[1],a2=a[2],a3=a[3],a4=a[4],a5=a[5],v0=v[0],v1=v[1];out[0]=a0;out[1]=a1;out[2]=a2;out[3]=a3;out[4]=a0*v0+a2*v1+a4;out[5]=a1*v0+a3*v1+a5;return out;}; /**
 * Creates a matrix from a given angle
 * This is equivalent to (but much faster than):
 *
 *     mat2d.identity(dest);
 *     mat2d.rotate(dest, dest, rad);
 *
 * @param {mat2d} out mat2d receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2d} out
 */mat2d.fromRotation=function(out,rad){var s=Math.sin(rad),c=Math.cos(rad);out[0]=c;out[1]=s;out[2]=-s;out[3]=c;out[4]=0;out[5]=0;return out;}; /**
 * Creates a matrix from a vector scaling
 * This is equivalent to (but much faster than):
 *
 *     mat2d.identity(dest);
 *     mat2d.scale(dest, dest, vec);
 *
 * @param {mat2d} out mat2d receiving operation result
 * @param {vec2} v Scaling vector
 * @returns {mat2d} out
 */mat2d.fromScaling=function(out,v){out[0]=v[0];out[1]=0;out[2]=0;out[3]=v[1];out[4]=0;out[5]=0;return out;}; /**
 * Creates a matrix from a vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat2d.identity(dest);
 *     mat2d.translate(dest, dest, vec);
 *
 * @param {mat2d} out mat2d receiving operation result
 * @param {vec2} v Translation vector
 * @returns {mat2d} out
 */mat2d.fromTranslation=function(out,v){out[0]=1;out[1]=0;out[2]=0;out[3]=1;out[4]=v[0];out[5]=v[1];return out;}; /**
 * Returns a string representation of a mat2d
 *
 * @param {mat2d} a matrix to represent as a string
 * @returns {String} string representation of the matrix
 */mat2d.str=function(a){return 'mat2d('+a[0]+', '+a[1]+', '+a[2]+', '+a[3]+', '+a[4]+', '+a[5]+')';}; /**
 * Returns Frobenius norm of a mat2d
 *
 * @param {mat2d} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */mat2d.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+1);};module.exports=mat2d;},{"./common.js":2}],5:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */var glMatrix=_dereq_("./common.js"); /**
 * @class 3x3 Matrix
 * @name mat3
 */var mat3={}; /**
 * Creates a new identity mat3
 *
 * @returns {mat3} a new 3x3 matrix
 */mat3.create=function(){var out=new glMatrix.ARRAY_TYPE(9);out[0]=1;out[1]=0;out[2]=0;out[3]=0;out[4]=1;out[5]=0;out[6]=0;out[7]=0;out[8]=1;return out;}; /**
 * Copies the upper-left 3x3 values into the given mat3.
 *
 * @param {mat3} out the receiving 3x3 matrix
 * @param {mat4} a   the source 4x4 matrix
 * @returns {mat3} out
 */mat3.fromMat4=function(out,a){out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[4];out[4]=a[5];out[5]=a[6];out[6]=a[8];out[7]=a[9];out[8]=a[10];return out;}; /**
 * Creates a new mat3 initialized with values from an existing matrix
 *
 * @param {mat3} a matrix to clone
 * @returns {mat3} a new 3x3 matrix
 */mat3.clone=function(a){var out=new glMatrix.ARRAY_TYPE(9);out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];out[4]=a[4];out[5]=a[5];out[6]=a[6];out[7]=a[7];out[8]=a[8];return out;}; /**
 * Copy the values from one mat3 to another
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */mat3.copy=function(out,a){out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];out[4]=a[4];out[5]=a[5];out[6]=a[6];out[7]=a[7];out[8]=a[8];return out;}; /**
 * Set a mat3 to the identity matrix
 *
 * @param {mat3} out the receiving matrix
 * @returns {mat3} out
 */mat3.identity=function(out){out[0]=1;out[1]=0;out[2]=0;out[3]=0;out[4]=1;out[5]=0;out[6]=0;out[7]=0;out[8]=1;return out;}; /**
 * Transpose the values of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */mat3.transpose=function(out,a){ // If we are transposing ourselves we can skip a few steps but have to cache some values
if(out===a){var a01=a[1],a02=a[2],a12=a[5];out[1]=a[3];out[2]=a[6];out[3]=a01;out[5]=a[7];out[6]=a02;out[7]=a12;}else {out[0]=a[0];out[1]=a[3];out[2]=a[6];out[3]=a[1];out[4]=a[4];out[5]=a[7];out[6]=a[2];out[7]=a[5];out[8]=a[8];}return out;}; /**
 * Inverts a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */mat3.invert=function(out,a){var a00=a[0],a01=a[1],a02=a[2],a10=a[3],a11=a[4],a12=a[5],a20=a[6],a21=a[7],a22=a[8],b01=a22*a11-a12*a21,b11=-a22*a10+a12*a20,b21=a21*a10-a11*a20, // Calculate the determinant
det=a00*b01+a01*b11+a02*b21;if(!det){return null;}det=1.0/det;out[0]=b01*det;out[1]=(-a22*a01+a02*a21)*det;out[2]=(a12*a01-a02*a11)*det;out[3]=b11*det;out[4]=(a22*a00-a02*a20)*det;out[5]=(-a12*a00+a02*a10)*det;out[6]=b21*det;out[7]=(-a21*a00+a01*a20)*det;out[8]=(a11*a00-a01*a10)*det;return out;}; /**
 * Calculates the adjugate of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */mat3.adjoint=function(out,a){var a00=a[0],a01=a[1],a02=a[2],a10=a[3],a11=a[4],a12=a[5],a20=a[6],a21=a[7],a22=a[8];out[0]=a11*a22-a12*a21;out[1]=a02*a21-a01*a22;out[2]=a01*a12-a02*a11;out[3]=a12*a20-a10*a22;out[4]=a00*a22-a02*a20;out[5]=a02*a10-a00*a12;out[6]=a10*a21-a11*a20;out[7]=a01*a20-a00*a21;out[8]=a00*a11-a01*a10;return out;}; /**
 * Calculates the determinant of a mat3
 *
 * @param {mat3} a the source matrix
 * @returns {Number} determinant of a
 */mat3.determinant=function(a){var a00=a[0],a01=a[1],a02=a[2],a10=a[3],a11=a[4],a12=a[5],a20=a[6],a21=a[7],a22=a[8];return a00*(a22*a11-a12*a21)+a01*(-a22*a10+a12*a20)+a02*(a21*a10-a11*a20);}; /**
 * Multiplies two mat3's
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the first operand
 * @param {mat3} b the second operand
 * @returns {mat3} out
 */mat3.multiply=function(out,a,b){var a00=a[0],a01=a[1],a02=a[2],a10=a[3],a11=a[4],a12=a[5],a20=a[6],a21=a[7],a22=a[8],b00=b[0],b01=b[1],b02=b[2],b10=b[3],b11=b[4],b12=b[5],b20=b[6],b21=b[7],b22=b[8];out[0]=b00*a00+b01*a10+b02*a20;out[1]=b00*a01+b01*a11+b02*a21;out[2]=b00*a02+b01*a12+b02*a22;out[3]=b10*a00+b11*a10+b12*a20;out[4]=b10*a01+b11*a11+b12*a21;out[5]=b10*a02+b11*a12+b12*a22;out[6]=b20*a00+b21*a10+b22*a20;out[7]=b20*a01+b21*a11+b22*a21;out[8]=b20*a02+b21*a12+b22*a22;return out;}; /**
 * Alias for {@link mat3.multiply}
 * @function
 */mat3.mul=mat3.multiply; /**
 * Translate a mat3 by the given vector
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to translate
 * @param {vec2} v vector to translate by
 * @returns {mat3} out
 */mat3.translate=function(out,a,v){var a00=a[0],a01=a[1],a02=a[2],a10=a[3],a11=a[4],a12=a[5],a20=a[6],a21=a[7],a22=a[8],x=v[0],y=v[1];out[0]=a00;out[1]=a01;out[2]=a02;out[3]=a10;out[4]=a11;out[5]=a12;out[6]=x*a00+y*a10+a20;out[7]=x*a01+y*a11+a21;out[8]=x*a02+y*a12+a22;return out;}; /**
 * Rotates a mat3 by the given angle
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat3} out
 */mat3.rotate=function(out,a,rad){var a00=a[0],a01=a[1],a02=a[2],a10=a[3],a11=a[4],a12=a[5],a20=a[6],a21=a[7],a22=a[8],s=Math.sin(rad),c=Math.cos(rad);out[0]=c*a00+s*a10;out[1]=c*a01+s*a11;out[2]=c*a02+s*a12;out[3]=c*a10-s*a00;out[4]=c*a11-s*a01;out[5]=c*a12-s*a02;out[6]=a20;out[7]=a21;out[8]=a22;return out;}; /**
 * Scales the mat3 by the dimensions in the given vec2
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to rotate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat3} out
 **/mat3.scale=function(out,a,v){var x=v[0],y=v[1];out[0]=x*a[0];out[1]=x*a[1];out[2]=x*a[2];out[3]=y*a[3];out[4]=y*a[4];out[5]=y*a[5];out[6]=a[6];out[7]=a[7];out[8]=a[8];return out;}; /**
 * Creates a matrix from a vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat3.identity(dest);
 *     mat3.translate(dest, dest, vec);
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {vec2} v Translation vector
 * @returns {mat3} out
 */mat3.fromTranslation=function(out,v){out[0]=1;out[1]=0;out[2]=0;out[3]=0;out[4]=1;out[5]=0;out[6]=v[0];out[7]=v[1];out[8]=1;return out;}; /**
 * Creates a matrix from a given angle
 * This is equivalent to (but much faster than):
 *
 *     mat3.identity(dest);
 *     mat3.rotate(dest, dest, rad);
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat3} out
 */mat3.fromRotation=function(out,rad){var s=Math.sin(rad),c=Math.cos(rad);out[0]=c;out[1]=s;out[2]=0;out[3]=-s;out[4]=c;out[5]=0;out[6]=0;out[7]=0;out[8]=1;return out;}; /**
 * Creates a matrix from a vector scaling
 * This is equivalent to (but much faster than):
 *
 *     mat3.identity(dest);
 *     mat3.scale(dest, dest, vec);
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {vec2} v Scaling vector
 * @returns {mat3} out
 */mat3.fromScaling=function(out,v){out[0]=v[0];out[1]=0;out[2]=0;out[3]=0;out[4]=v[1];out[5]=0;out[6]=0;out[7]=0;out[8]=1;return out;}; /**
 * Copies the values from a mat2d into a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat2d} a the matrix to copy
 * @returns {mat3} out
 **/mat3.fromMat2d=function(out,a){out[0]=a[0];out[1]=a[1];out[2]=0;out[3]=a[2];out[4]=a[3];out[5]=0;out[6]=a[4];out[7]=a[5];out[8]=1;return out;}; /**
* Calculates a 3x3 matrix from the given quaternion
*
* @param {mat3} out mat3 receiving operation result
* @param {quat} q Quaternion to create matrix from
*
* @returns {mat3} out
*/mat3.fromQuat=function(out,q){var x=q[0],y=q[1],z=q[2],w=q[3],x2=x+x,y2=y+y,z2=z+z,xx=x*x2,yx=y*x2,yy=y*y2,zx=z*x2,zy=z*y2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;out[0]=1-yy-zz;out[3]=yx-wz;out[6]=zx+wy;out[1]=yx+wz;out[4]=1-xx-zz;out[7]=zy-wx;out[2]=zx-wy;out[5]=zy+wx;out[8]=1-xx-yy;return out;}; /**
* Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
*
* @param {mat3} out mat3 receiving operation result
* @param {mat4} a Mat4 to derive the normal matrix from
*
* @returns {mat3} out
*/mat3.normalFromMat4=function(out,a){var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15],b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32, // Calculate the determinant
det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;if(!det){return null;}det=1.0/det;out[0]=(a11*b11-a12*b10+a13*b09)*det;out[1]=(a12*b08-a10*b11-a13*b07)*det;out[2]=(a10*b10-a11*b08+a13*b06)*det;out[3]=(a02*b10-a01*b11-a03*b09)*det;out[4]=(a00*b11-a02*b08+a03*b07)*det;out[5]=(a01*b08-a00*b10-a03*b06)*det;out[6]=(a31*b05-a32*b04+a33*b03)*det;out[7]=(a32*b02-a30*b05-a33*b01)*det;out[8]=(a30*b04-a31*b02+a33*b00)*det;return out;}; /**
 * Returns a string representation of a mat3
 *
 * @param {mat3} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */mat3.str=function(a){return 'mat3('+a[0]+', '+a[1]+', '+a[2]+', '+a[3]+', '+a[4]+', '+a[5]+', '+a[6]+', '+a[7]+', '+a[8]+')';}; /**
 * Returns Frobenius norm of a mat3
 *
 * @param {mat3} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */mat3.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+Math.pow(a[6],2)+Math.pow(a[7],2)+Math.pow(a[8],2));};module.exports=mat3;},{"./common.js":2}],6:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */var glMatrix=_dereq_("./common.js"); /**
 * @class 4x4 Matrix
 * @name mat4
 */var mat4={}; /**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */mat4.create=function(){var out=new glMatrix.ARRAY_TYPE(16);out[0]=1;out[1]=0;out[2]=0;out[3]=0;out[4]=0;out[5]=1;out[6]=0;out[7]=0;out[8]=0;out[9]=0;out[10]=1;out[11]=0;out[12]=0;out[13]=0;out[14]=0;out[15]=1;return out;}; /**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {mat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */mat4.clone=function(a){var out=new glMatrix.ARRAY_TYPE(16);out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];out[4]=a[4];out[5]=a[5];out[6]=a[6];out[7]=a[7];out[8]=a[8];out[9]=a[9];out[10]=a[10];out[11]=a[11];out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];return out;}; /**
 * Copy the values from one mat4 to another
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */mat4.copy=function(out,a){out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];out[4]=a[4];out[5]=a[5];out[6]=a[6];out[7]=a[7];out[8]=a[8];out[9]=a[9];out[10]=a[10];out[11]=a[11];out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];return out;}; /**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */mat4.identity=function(out){out[0]=1;out[1]=0;out[2]=0;out[3]=0;out[4]=0;out[5]=1;out[6]=0;out[7]=0;out[8]=0;out[9]=0;out[10]=1;out[11]=0;out[12]=0;out[13]=0;out[14]=0;out[15]=1;return out;}; /**
 * Transpose the values of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */mat4.transpose=function(out,a){ // If we are transposing ourselves we can skip a few steps but have to cache some values
if(out===a){var a01=a[1],a02=a[2],a03=a[3],a12=a[6],a13=a[7],a23=a[11];out[1]=a[4];out[2]=a[8];out[3]=a[12];out[4]=a01;out[6]=a[9];out[7]=a[13];out[8]=a02;out[9]=a12;out[11]=a[14];out[12]=a03;out[13]=a13;out[14]=a23;}else {out[0]=a[0];out[1]=a[4];out[2]=a[8];out[3]=a[12];out[4]=a[1];out[5]=a[5];out[6]=a[9];out[7]=a[13];out[8]=a[2];out[9]=a[6];out[10]=a[10];out[11]=a[14];out[12]=a[3];out[13]=a[7];out[14]=a[11];out[15]=a[15];}return out;}; /**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */mat4.invert=function(out,a){var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15],b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32, // Calculate the determinant
det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;if(!det){return null;}det=1.0/det;out[0]=(a11*b11-a12*b10+a13*b09)*det;out[1]=(a02*b10-a01*b11-a03*b09)*det;out[2]=(a31*b05-a32*b04+a33*b03)*det;out[3]=(a22*b04-a21*b05-a23*b03)*det;out[4]=(a12*b08-a10*b11-a13*b07)*det;out[5]=(a00*b11-a02*b08+a03*b07)*det;out[6]=(a32*b02-a30*b05-a33*b01)*det;out[7]=(a20*b05-a22*b02+a23*b01)*det;out[8]=(a10*b10-a11*b08+a13*b06)*det;out[9]=(a01*b08-a00*b10-a03*b06)*det;out[10]=(a30*b04-a31*b02+a33*b00)*det;out[11]=(a21*b02-a20*b04-a23*b00)*det;out[12]=(a11*b07-a10*b09-a12*b06)*det;out[13]=(a00*b09-a01*b07+a02*b06)*det;out[14]=(a31*b01-a30*b03-a32*b00)*det;out[15]=(a20*b03-a21*b01+a22*b00)*det;return out;}; /**
 * Calculates the adjugate of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */mat4.adjoint=function(out,a){var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];out[0]=a11*(a22*a33-a23*a32)-a21*(a12*a33-a13*a32)+a31*(a12*a23-a13*a22);out[1]=-(a01*(a22*a33-a23*a32)-a21*(a02*a33-a03*a32)+a31*(a02*a23-a03*a22));out[2]=a01*(a12*a33-a13*a32)-a11*(a02*a33-a03*a32)+a31*(a02*a13-a03*a12);out[3]=-(a01*(a12*a23-a13*a22)-a11*(a02*a23-a03*a22)+a21*(a02*a13-a03*a12));out[4]=-(a10*(a22*a33-a23*a32)-a20*(a12*a33-a13*a32)+a30*(a12*a23-a13*a22));out[5]=a00*(a22*a33-a23*a32)-a20*(a02*a33-a03*a32)+a30*(a02*a23-a03*a22);out[6]=-(a00*(a12*a33-a13*a32)-a10*(a02*a33-a03*a32)+a30*(a02*a13-a03*a12));out[7]=a00*(a12*a23-a13*a22)-a10*(a02*a23-a03*a22)+a20*(a02*a13-a03*a12);out[8]=a10*(a21*a33-a23*a31)-a20*(a11*a33-a13*a31)+a30*(a11*a23-a13*a21);out[9]=-(a00*(a21*a33-a23*a31)-a20*(a01*a33-a03*a31)+a30*(a01*a23-a03*a21));out[10]=a00*(a11*a33-a13*a31)-a10*(a01*a33-a03*a31)+a30*(a01*a13-a03*a11);out[11]=-(a00*(a11*a23-a13*a21)-a10*(a01*a23-a03*a21)+a20*(a01*a13-a03*a11));out[12]=-(a10*(a21*a32-a22*a31)-a20*(a11*a32-a12*a31)+a30*(a11*a22-a12*a21));out[13]=a00*(a21*a32-a22*a31)-a20*(a01*a32-a02*a31)+a30*(a01*a22-a02*a21);out[14]=-(a00*(a11*a32-a12*a31)-a10*(a01*a32-a02*a31)+a30*(a01*a12-a02*a11));out[15]=a00*(a11*a22-a12*a21)-a10*(a01*a22-a02*a21)+a20*(a01*a12-a02*a11);return out;}; /**
 * Calculates the determinant of a mat4
 *
 * @param {mat4} a the source matrix
 * @returns {Number} determinant of a
 */mat4.determinant=function(a){var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15],b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32; // Calculate the determinant
return b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;}; /**
 * Multiplies two mat4's
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the first operand
 * @param {mat4} b the second operand
 * @returns {mat4} out
 */mat4.multiply=function(out,a,b){var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15]; // Cache only the current line of the second matrix
var b0=b[0],b1=b[1],b2=b[2],b3=b[3];out[0]=b0*a00+b1*a10+b2*a20+b3*a30;out[1]=b0*a01+b1*a11+b2*a21+b3*a31;out[2]=b0*a02+b1*a12+b2*a22+b3*a32;out[3]=b0*a03+b1*a13+b2*a23+b3*a33;b0=b[4];b1=b[5];b2=b[6];b3=b[7];out[4]=b0*a00+b1*a10+b2*a20+b3*a30;out[5]=b0*a01+b1*a11+b2*a21+b3*a31;out[6]=b0*a02+b1*a12+b2*a22+b3*a32;out[7]=b0*a03+b1*a13+b2*a23+b3*a33;b0=b[8];b1=b[9];b2=b[10];b3=b[11];out[8]=b0*a00+b1*a10+b2*a20+b3*a30;out[9]=b0*a01+b1*a11+b2*a21+b3*a31;out[10]=b0*a02+b1*a12+b2*a22+b3*a32;out[11]=b0*a03+b1*a13+b2*a23+b3*a33;b0=b[12];b1=b[13];b2=b[14];b3=b[15];out[12]=b0*a00+b1*a10+b2*a20+b3*a30;out[13]=b0*a01+b1*a11+b2*a21+b3*a31;out[14]=b0*a02+b1*a12+b2*a22+b3*a32;out[15]=b0*a03+b1*a13+b2*a23+b3*a33;return out;}; /**
 * Alias for {@link mat4.multiply}
 * @function
 */mat4.mul=mat4.multiply; /**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to translate
 * @param {vec3} v vector to translate by
 * @returns {mat4} out
 */mat4.translate=function(out,a,v){var x=v[0],y=v[1],z=v[2],a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23;if(a===out){out[12]=a[0]*x+a[4]*y+a[8]*z+a[12];out[13]=a[1]*x+a[5]*y+a[9]*z+a[13];out[14]=a[2]*x+a[6]*y+a[10]*z+a[14];out[15]=a[3]*x+a[7]*y+a[11]*z+a[15];}else {a00=a[0];a01=a[1];a02=a[2];a03=a[3];a10=a[4];a11=a[5];a12=a[6];a13=a[7];a20=a[8];a21=a[9];a22=a[10];a23=a[11];out[0]=a00;out[1]=a01;out[2]=a02;out[3]=a03;out[4]=a10;out[5]=a11;out[6]=a12;out[7]=a13;out[8]=a20;out[9]=a21;out[10]=a22;out[11]=a23;out[12]=a00*x+a10*y+a20*z+a[12];out[13]=a01*x+a11*y+a21*z+a[13];out[14]=a02*x+a12*y+a22*z+a[14];out[15]=a03*x+a13*y+a23*z+a[15];}return out;}; /**
 * Scales the mat4 by the dimensions in the given vec3
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to scale
 * @param {vec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/mat4.scale=function(out,a,v){var x=v[0],y=v[1],z=v[2];out[0]=a[0]*x;out[1]=a[1]*x;out[2]=a[2]*x;out[3]=a[3]*x;out[4]=a[4]*y;out[5]=a[5]*y;out[6]=a[6]*y;out[7]=a[7]*y;out[8]=a[8]*z;out[9]=a[9]*z;out[10]=a[10]*z;out[11]=a[11]*z;out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];return out;}; /**
 * Rotates a mat4 by the given angle around the given axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {vec3} axis the axis to rotate around
 * @returns {mat4} out
 */mat4.rotate=function(out,a,rad,axis){var x=axis[0],y=axis[1],z=axis[2],len=Math.sqrt(x*x+y*y+z*z),s,c,t,a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,b00,b01,b02,b10,b11,b12,b20,b21,b22;if(Math.abs(len)<glMatrix.EPSILON){return null;}len=1/len;x*=len;y*=len;z*=len;s=Math.sin(rad);c=Math.cos(rad);t=1-c;a00=a[0];a01=a[1];a02=a[2];a03=a[3];a10=a[4];a11=a[5];a12=a[6];a13=a[7];a20=a[8];a21=a[9];a22=a[10];a23=a[11]; // Construct the elements of the rotation matrix
b00=x*x*t+c;b01=y*x*t+z*s;b02=z*x*t-y*s;b10=x*y*t-z*s;b11=y*y*t+c;b12=z*y*t+x*s;b20=x*z*t+y*s;b21=y*z*t-x*s;b22=z*z*t+c; // Perform rotation-specific matrix multiplication
out[0]=a00*b00+a10*b01+a20*b02;out[1]=a01*b00+a11*b01+a21*b02;out[2]=a02*b00+a12*b01+a22*b02;out[3]=a03*b00+a13*b01+a23*b02;out[4]=a00*b10+a10*b11+a20*b12;out[5]=a01*b10+a11*b11+a21*b12;out[6]=a02*b10+a12*b11+a22*b12;out[7]=a03*b10+a13*b11+a23*b12;out[8]=a00*b20+a10*b21+a20*b22;out[9]=a01*b20+a11*b21+a21*b22;out[10]=a02*b20+a12*b21+a22*b22;out[11]=a03*b20+a13*b21+a23*b22;if(a!==out){ // If the source and destination differ, copy the unchanged last row
out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];}return out;}; /**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */mat4.rotateX=function(out,a,rad){var s=Math.sin(rad),c=Math.cos(rad),a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11];if(a!==out){ // If the source and destination differ, copy the unchanged rows
out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];} // Perform axis-specific matrix multiplication
out[4]=a10*c+a20*s;out[5]=a11*c+a21*s;out[6]=a12*c+a22*s;out[7]=a13*c+a23*s;out[8]=a20*c-a10*s;out[9]=a21*c-a11*s;out[10]=a22*c-a12*s;out[11]=a23*c-a13*s;return out;}; /**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */mat4.rotateY=function(out,a,rad){var s=Math.sin(rad),c=Math.cos(rad),a00=a[0],a01=a[1],a02=a[2],a03=a[3],a20=a[8],a21=a[9],a22=a[10],a23=a[11];if(a!==out){ // If the source and destination differ, copy the unchanged rows
out[4]=a[4];out[5]=a[5];out[6]=a[6];out[7]=a[7];out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];} // Perform axis-specific matrix multiplication
out[0]=a00*c-a20*s;out[1]=a01*c-a21*s;out[2]=a02*c-a22*s;out[3]=a03*c-a23*s;out[8]=a00*s+a20*c;out[9]=a01*s+a21*c;out[10]=a02*s+a22*c;out[11]=a03*s+a23*c;return out;}; /**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */mat4.rotateZ=function(out,a,rad){var s=Math.sin(rad),c=Math.cos(rad),a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7];if(a!==out){ // If the source and destination differ, copy the unchanged last row
out[8]=a[8];out[9]=a[9];out[10]=a[10];out[11]=a[11];out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];} // Perform axis-specific matrix multiplication
out[0]=a00*c+a10*s;out[1]=a01*c+a11*s;out[2]=a02*c+a12*s;out[3]=a03*c+a13*s;out[4]=a10*c-a00*s;out[5]=a11*c-a01*s;out[6]=a12*c-a02*s;out[7]=a13*c-a03*s;return out;}; /**
 * Creates a matrix from a vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, dest, vec);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {vec3} v Translation vector
 * @returns {mat4} out
 */mat4.fromTranslation=function(out,v){out[0]=1;out[1]=0;out[2]=0;out[3]=0;out[4]=0;out[5]=1;out[6]=0;out[7]=0;out[8]=0;out[9]=0;out[10]=1;out[11]=0;out[12]=v[0];out[13]=v[1];out[14]=v[2];out[15]=1;return out;}; /**
 * Creates a matrix from a vector scaling
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.scale(dest, dest, vec);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {vec3} v Scaling vector
 * @returns {mat4} out
 */mat4.fromScaling=function(out,v){out[0]=v[0];out[1]=0;out[2]=0;out[3]=0;out[4]=0;out[5]=v[1];out[6]=0;out[7]=0;out[8]=0;out[9]=0;out[10]=v[2];out[11]=0;out[12]=0;out[13]=0;out[14]=0;out[15]=1;return out;}; /**
 * Creates a matrix from a given angle around a given axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.rotate(dest, dest, rad, axis);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @param {vec3} axis the axis to rotate around
 * @returns {mat4} out
 */mat4.fromRotation=function(out,rad,axis){var x=axis[0],y=axis[1],z=axis[2],len=Math.sqrt(x*x+y*y+z*z),s,c,t;if(Math.abs(len)<glMatrix.EPSILON){return null;}len=1/len;x*=len;y*=len;z*=len;s=Math.sin(rad);c=Math.cos(rad);t=1-c; // Perform rotation-specific matrix multiplication
out[0]=x*x*t+c;out[1]=y*x*t+z*s;out[2]=z*x*t-y*s;out[3]=0;out[4]=x*y*t-z*s;out[5]=y*y*t+c;out[6]=z*y*t+x*s;out[7]=0;out[8]=x*z*t+y*s;out[9]=y*z*t-x*s;out[10]=z*z*t+c;out[11]=0;out[12]=0;out[13]=0;out[14]=0;out[15]=1;return out;}; /**
 * Creates a matrix from the given angle around the X axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.rotateX(dest, dest, rad);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */mat4.fromXRotation=function(out,rad){var s=Math.sin(rad),c=Math.cos(rad); // Perform axis-specific matrix multiplication
out[0]=1;out[1]=0;out[2]=0;out[3]=0;out[4]=0;out[5]=c;out[6]=s;out[7]=0;out[8]=0;out[9]=-s;out[10]=c;out[11]=0;out[12]=0;out[13]=0;out[14]=0;out[15]=1;return out;}; /**
 * Creates a matrix from the given angle around the Y axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.rotateY(dest, dest, rad);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */mat4.fromYRotation=function(out,rad){var s=Math.sin(rad),c=Math.cos(rad); // Perform axis-specific matrix multiplication
out[0]=c;out[1]=0;out[2]=-s;out[3]=0;out[4]=0;out[5]=1;out[6]=0;out[7]=0;out[8]=s;out[9]=0;out[10]=c;out[11]=0;out[12]=0;out[13]=0;out[14]=0;out[15]=1;return out;}; /**
 * Creates a matrix from the given angle around the Z axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.rotateZ(dest, dest, rad);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */mat4.fromZRotation=function(out,rad){var s=Math.sin(rad),c=Math.cos(rad); // Perform axis-specific matrix multiplication
out[0]=c;out[1]=s;out[2]=0;out[3]=0;out[4]=-s;out[5]=c;out[6]=0;out[7]=0;out[8]=0;out[9]=0;out[10]=1;out[11]=0;out[12]=0;out[13]=0;out[14]=0;out[15]=1;return out;}; /**
 * Creates a matrix from a quaternion rotation and vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     var quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {vec3} v Translation vector
 * @returns {mat4} out
 */mat4.fromRotationTranslation=function(out,q,v){ // Quaternion math
var x=q[0],y=q[1],z=q[2],w=q[3],x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;out[0]=1-(yy+zz);out[1]=xy+wz;out[2]=xz-wy;out[3]=0;out[4]=xy-wz;out[5]=1-(xx+zz);out[6]=yz+wx;out[7]=0;out[8]=xz+wy;out[9]=yz-wx;out[10]=1-(xx+yy);out[11]=0;out[12]=v[0];out[13]=v[1];out[14]=v[2];out[15]=1;return out;}; /**
 * Creates a matrix from a quaternion rotation, vector translation and vector scale
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     var quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *     mat4.scale(dest, scale)
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {vec3} v Translation vector
 * @param {vec3} s Scaling vector
 * @returns {mat4} out
 */mat4.fromRotationTranslationScale=function(out,q,v,s){ // Quaternion math
var x=q[0],y=q[1],z=q[2],w=q[3],x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2,sx=s[0],sy=s[1],sz=s[2];out[0]=(1-(yy+zz))*sx;out[1]=(xy+wz)*sx;out[2]=(xz-wy)*sx;out[3]=0;out[4]=(xy-wz)*sy;out[5]=(1-(xx+zz))*sy;out[6]=(yz+wx)*sy;out[7]=0;out[8]=(xz+wy)*sz;out[9]=(yz-wx)*sz;out[10]=(1-(xx+yy))*sz;out[11]=0;out[12]=v[0];out[13]=v[1];out[14]=v[2];out[15]=1;return out;}; /**
 * Creates a matrix from a quaternion rotation, vector translation and vector scale, rotating and scaling around the given origin
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     mat4.translate(dest, origin);
 *     var quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *     mat4.scale(dest, scale)
 *     mat4.translate(dest, negativeOrigin);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {vec3} v Translation vector
 * @param {vec3} s Scaling vector
 * @param {vec3} o The origin vector around which to scale and rotate
 * @returns {mat4} out
 */mat4.fromRotationTranslationScaleOrigin=function(out,q,v,s,o){ // Quaternion math
var x=q[0],y=q[1],z=q[2],w=q[3],x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2,sx=s[0],sy=s[1],sz=s[2],ox=o[0],oy=o[1],oz=o[2];out[0]=(1-(yy+zz))*sx;out[1]=(xy+wz)*sx;out[2]=(xz-wy)*sx;out[3]=0;out[4]=(xy-wz)*sy;out[5]=(1-(xx+zz))*sy;out[6]=(yz+wx)*sy;out[7]=0;out[8]=(xz+wy)*sz;out[9]=(yz-wx)*sz;out[10]=(1-(xx+yy))*sz;out[11]=0;out[12]=v[0]+ox-(out[0]*ox+out[4]*oy+out[8]*oz);out[13]=v[1]+oy-(out[1]*ox+out[5]*oy+out[9]*oz);out[14]=v[2]+oz-(out[2]*ox+out[6]*oy+out[10]*oz);out[15]=1;return out;};mat4.fromQuat=function(out,q){var x=q[0],y=q[1],z=q[2],w=q[3],x2=x+x,y2=y+y,z2=z+z,xx=x*x2,yx=y*x2,yy=y*y2,zx=z*x2,zy=z*y2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;out[0]=1-yy-zz;out[1]=yx+wz;out[2]=zx-wy;out[3]=0;out[4]=yx-wz;out[5]=1-xx-zz;out[6]=zy+wx;out[7]=0;out[8]=zx+wy;out[9]=zy-wx;out[10]=1-xx-yy;out[11]=0;out[12]=0;out[13]=0;out[14]=0;out[15]=1;return out;}; /**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */mat4.frustum=function(out,left,right,bottom,top,near,far){var rl=1/(right-left),tb=1/(top-bottom),nf=1/(near-far);out[0]=near*2*rl;out[1]=0;out[2]=0;out[3]=0;out[4]=0;out[5]=near*2*tb;out[6]=0;out[7]=0;out[8]=(right+left)*rl;out[9]=(top+bottom)*tb;out[10]=(far+near)*nf;out[11]=-1;out[12]=0;out[13]=0;out[14]=far*near*2*nf;out[15]=0;return out;}; /**
 * Generates a perspective projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */mat4.perspective=function(out,fovy,aspect,near,far){var f=1.0/Math.tan(fovy/2),nf=1/(near-far);out[0]=f/aspect;out[1]=0;out[2]=0;out[3]=0;out[4]=0;out[5]=f;out[6]=0;out[7]=0;out[8]=0;out[9]=0;out[10]=(far+near)*nf;out[11]=-1;out[12]=0;out[13]=0;out[14]=2*far*near*nf;out[15]=0;return out;}; /**
 * Generates a perspective projection matrix with the given field of view.
 * This is primarily useful for generating projection matrices to be used
 * with the still experiemental WebVR API.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fov Object containing the following values: upDegrees, downDegrees, leftDegrees, rightDegrees
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */mat4.perspectiveFromFieldOfView=function(out,fov,near,far){var upTan=Math.tan(fov.upDegrees*Math.PI/180.0),downTan=Math.tan(fov.downDegrees*Math.PI/180.0),leftTan=Math.tan(fov.leftDegrees*Math.PI/180.0),rightTan=Math.tan(fov.rightDegrees*Math.PI/180.0),xScale=2.0/(leftTan+rightTan),yScale=2.0/(upTan+downTan);out[0]=xScale;out[1]=0.0;out[2]=0.0;out[3]=0.0;out[4]=0.0;out[5]=yScale;out[6]=0.0;out[7]=0.0;out[8]=-((leftTan-rightTan)*xScale*0.5);out[9]=(upTan-downTan)*yScale*0.5;out[10]=far/(near-far);out[11]=-1.0;out[12]=0.0;out[13]=0.0;out[14]=far*near/(near-far);out[15]=0.0;return out;}; /**
 * Generates a orthogonal projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */mat4.ortho=function(out,left,right,bottom,top,near,far){var lr=1/(left-right),bt=1/(bottom-top),nf=1/(near-far);out[0]=-2*lr;out[1]=0;out[2]=0;out[3]=0;out[4]=0;out[5]=-2*bt;out[6]=0;out[7]=0;out[8]=0;out[9]=0;out[10]=2*nf;out[11]=0;out[12]=(left+right)*lr;out[13]=(top+bottom)*bt;out[14]=(far+near)*nf;out[15]=1;return out;}; /**
 * Generates a look-at matrix with the given eye position, focal point, and up axis
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {vec3} eye Position of the viewer
 * @param {vec3} center Point the viewer is looking at
 * @param {vec3} up vec3 pointing up
 * @returns {mat4} out
 */mat4.lookAt=function(out,eye,center,up){var x0,x1,x2,y0,y1,y2,z0,z1,z2,len,eyex=eye[0],eyey=eye[1],eyez=eye[2],upx=up[0],upy=up[1],upz=up[2],centerx=center[0],centery=center[1],centerz=center[2];if(Math.abs(eyex-centerx)<glMatrix.EPSILON&&Math.abs(eyey-centery)<glMatrix.EPSILON&&Math.abs(eyez-centerz)<glMatrix.EPSILON){return mat4.identity(out);}z0=eyex-centerx;z1=eyey-centery;z2=eyez-centerz;len=1/Math.sqrt(z0*z0+z1*z1+z2*z2);z0*=len;z1*=len;z2*=len;x0=upy*z2-upz*z1;x1=upz*z0-upx*z2;x2=upx*z1-upy*z0;len=Math.sqrt(x0*x0+x1*x1+x2*x2);if(!len){x0=0;x1=0;x2=0;}else {len=1/len;x0*=len;x1*=len;x2*=len;}y0=z1*x2-z2*x1;y1=z2*x0-z0*x2;y2=z0*x1-z1*x0;len=Math.sqrt(y0*y0+y1*y1+y2*y2);if(!len){y0=0;y1=0;y2=0;}else {len=1/len;y0*=len;y1*=len;y2*=len;}out[0]=x0;out[1]=y0;out[2]=z0;out[3]=0;out[4]=x1;out[5]=y1;out[6]=z1;out[7]=0;out[8]=x2;out[9]=y2;out[10]=z2;out[11]=0;out[12]=-(x0*eyex+x1*eyey+x2*eyez);out[13]=-(y0*eyex+y1*eyey+y2*eyez);out[14]=-(z0*eyex+z1*eyey+z2*eyez);out[15]=1;return out;}; /**
 * Returns a string representation of a mat4
 *
 * @param {mat4} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */mat4.str=function(a){return 'mat4('+a[0]+', '+a[1]+', '+a[2]+', '+a[3]+', '+a[4]+', '+a[5]+', '+a[6]+', '+a[7]+', '+a[8]+', '+a[9]+', '+a[10]+', '+a[11]+', '+a[12]+', '+a[13]+', '+a[14]+', '+a[15]+')';}; /**
 * Returns Frobenius norm of a mat4
 *
 * @param {mat4} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */mat4.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+Math.pow(a[6],2)+Math.pow(a[7],2)+Math.pow(a[8],2)+Math.pow(a[9],2)+Math.pow(a[10],2)+Math.pow(a[11],2)+Math.pow(a[12],2)+Math.pow(a[13],2)+Math.pow(a[14],2)+Math.pow(a[15],2));};module.exports=mat4;},{"./common.js":2}],7:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */var glMatrix=_dereq_("./common.js");var mat3=_dereq_("./mat3.js");var vec3=_dereq_("./vec3.js");var vec4=_dereq_("./vec4.js"); /**
 * @class Quaternion
 * @name quat
 */var quat={}; /**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */quat.create=function(){var out=new glMatrix.ARRAY_TYPE(4);out[0]=0;out[1]=0;out[2]=0;out[3]=1;return out;}; /**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {vec3} a the initial vector
 * @param {vec3} b the destination vector
 * @returns {quat} out
 */quat.rotationTo=function(){var tmpvec3=vec3.create();var xUnitVec3=vec3.fromValues(1,0,0);var yUnitVec3=vec3.fromValues(0,1,0);return function(out,a,b){var dot=vec3.dot(a,b);if(dot<-0.999999){vec3.cross(tmpvec3,xUnitVec3,a);if(vec3.length(tmpvec3)<0.000001)vec3.cross(tmpvec3,yUnitVec3,a);vec3.normalize(tmpvec3,tmpvec3);quat.setAxisAngle(out,tmpvec3,Math.PI);return out;}else if(dot>0.999999){out[0]=0;out[1]=0;out[2]=0;out[3]=1;return out;}else {vec3.cross(tmpvec3,a,b);out[0]=tmpvec3[0];out[1]=tmpvec3[1];out[2]=tmpvec3[2];out[3]=1+dot;return quat.normalize(out,out);}};}(); /**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {vec3} view  the vector representing the viewing direction
 * @param {vec3} right the vector representing the local "right" direction
 * @param {vec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */quat.setAxes=function(){var matr=mat3.create();return function(out,view,right,up){matr[0]=right[0];matr[3]=right[1];matr[6]=right[2];matr[1]=up[0];matr[4]=up[1];matr[7]=up[2];matr[2]=-view[0];matr[5]=-view[1];matr[8]=-view[2];return quat.normalize(out,quat.fromMat3(out,matr));};}(); /**
 * Creates a new quat initialized with values from an existing quaternion
 *
 * @param {quat} a quaternion to clone
 * @returns {quat} a new quaternion
 * @function
 */quat.clone=vec4.clone; /**
 * Creates a new quat initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} a new quaternion
 * @function
 */quat.fromValues=vec4.fromValues; /**
 * Copy the values from one quat to another
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the source quaternion
 * @returns {quat} out
 * @function
 */quat.copy=vec4.copy; /**
 * Set the components of a quat to the given values
 *
 * @param {quat} out the receiving quaternion
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} out
 * @function
 */quat.set=vec4.set; /**
 * Set a quat to the identity quaternion
 *
 * @param {quat} out the receiving quaternion
 * @returns {quat} out
 */quat.identity=function(out){out[0]=0;out[1]=0;out[2]=0;out[3]=1;return out;}; /**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {vec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/quat.setAxisAngle=function(out,axis,rad){rad=rad*0.5;var s=Math.sin(rad);out[0]=s*axis[0];out[1]=s*axis[1];out[2]=s*axis[2];out[3]=Math.cos(rad);return out;}; /**
 * Adds two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 * @function
 */quat.add=vec4.add; /**
 * Multiplies two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 */quat.multiply=function(out,a,b){var ax=a[0],ay=a[1],az=a[2],aw=a[3],bx=b[0],by=b[1],bz=b[2],bw=b[3];out[0]=ax*bw+aw*bx+ay*bz-az*by;out[1]=ay*bw+aw*by+az*bx-ax*bz;out[2]=az*bw+aw*bz+ax*by-ay*bx;out[3]=aw*bw-ax*bx-ay*by-az*bz;return out;}; /**
 * Alias for {@link quat.multiply}
 * @function
 */quat.mul=quat.multiply; /**
 * Scales a quat by a scalar number
 *
 * @param {quat} out the receiving vector
 * @param {quat} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {quat} out
 * @function
 */quat.scale=vec4.scale; /**
 * Rotates a quaternion by the given angle about the X axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */quat.rotateX=function(out,a,rad){rad*=0.5;var ax=a[0],ay=a[1],az=a[2],aw=a[3],bx=Math.sin(rad),bw=Math.cos(rad);out[0]=ax*bw+aw*bx;out[1]=ay*bw+az*bx;out[2]=az*bw-ay*bx;out[3]=aw*bw-ax*bx;return out;}; /**
 * Rotates a quaternion by the given angle about the Y axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */quat.rotateY=function(out,a,rad){rad*=0.5;var ax=a[0],ay=a[1],az=a[2],aw=a[3],by=Math.sin(rad),bw=Math.cos(rad);out[0]=ax*bw-az*by;out[1]=ay*bw+aw*by;out[2]=az*bw+ax*by;out[3]=aw*bw-ay*by;return out;}; /**
 * Rotates a quaternion by the given angle about the Z axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */quat.rotateZ=function(out,a,rad){rad*=0.5;var ax=a[0],ay=a[1],az=a[2],aw=a[3],bz=Math.sin(rad),bw=Math.cos(rad);out[0]=ax*bw+ay*bz;out[1]=ay*bw-ax*bz;out[2]=az*bw+aw*bz;out[3]=aw*bw-az*bz;return out;}; /**
 * Calculates the W component of a quat from the X, Y, and Z components.
 * Assumes that quaternion is 1 unit in length.
 * Any existing W component will be ignored.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate W component of
 * @returns {quat} out
 */quat.calculateW=function(out,a){var x=a[0],y=a[1],z=a[2];out[0]=x;out[1]=y;out[2]=z;out[3]=Math.sqrt(Math.abs(1.0-x*x-y*y-z*z));return out;}; /**
 * Calculates the dot product of two quat's
 *
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {Number} dot product of a and b
 * @function
 */quat.dot=vec4.dot; /**
 * Performs a linear interpolation between two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 * @function
 */quat.lerp=vec4.lerp; /**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 */quat.slerp=function(out,a,b,t){ // benchmarks:
//    http://jsperf.com/quaternion-slerp-implementations
var ax=a[0],ay=a[1],az=a[2],aw=a[3],bx=b[0],by=b[1],bz=b[2],bw=b[3];var omega,cosom,sinom,scale0,scale1; // calc cosine
cosom=ax*bx+ay*by+az*bz+aw*bw; // adjust signs (if necessary)
if(cosom<0.0){cosom=-cosom;bx=-bx;by=-by;bz=-bz;bw=-bw;} // calculate coefficients
if(1.0-cosom>0.000001){ // standard case (slerp)
omega=Math.acos(cosom);sinom=Math.sin(omega);scale0=Math.sin((1.0-t)*omega)/sinom;scale1=Math.sin(t*omega)/sinom;}else { // "from" and "to" quaternions are very close 
//  ... so we can do a linear interpolation
scale0=1.0-t;scale1=t;} // calculate final values
out[0]=scale0*ax+scale1*bx;out[1]=scale0*ay+scale1*by;out[2]=scale0*az+scale1*bz;out[3]=scale0*aw+scale1*bw;return out;}; /**
 * Performs a spherical linear interpolation with two control points
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {quat} c the third operand
 * @param {quat} d the fourth operand
 * @param {Number} t interpolation amount
 * @returns {quat} out
 */quat.sqlerp=function(){var temp1=quat.create();var temp2=quat.create();return function(out,a,b,c,d,t){quat.slerp(temp1,a,d,t);quat.slerp(temp2,b,c,t);quat.slerp(out,temp1,temp2,2*t*(1-t));return out;};}(); /**
 * Calculates the inverse of a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate inverse of
 * @returns {quat} out
 */quat.invert=function(out,a){var a0=a[0],a1=a[1],a2=a[2],a3=a[3],dot=a0*a0+a1*a1+a2*a2+a3*a3,invDot=dot?1.0/dot:0; // TODO: Would be faster to return [0,0,0,0] immediately if dot == 0
out[0]=-a0*invDot;out[1]=-a1*invDot;out[2]=-a2*invDot;out[3]=a3*invDot;return out;}; /**
 * Calculates the conjugate of a quat
 * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate conjugate of
 * @returns {quat} out
 */quat.conjugate=function(out,a){out[0]=-a[0];out[1]=-a[1];out[2]=-a[2];out[3]=a[3];return out;}; /**
 * Calculates the length of a quat
 *
 * @param {quat} a vector to calculate length of
 * @returns {Number} length of a
 * @function
 */quat.length=vec4.length; /**
 * Alias for {@link quat.length}
 * @function
 */quat.len=quat.length; /**
 * Calculates the squared length of a quat
 *
 * @param {quat} a vector to calculate squared length of
 * @returns {Number} squared length of a
 * @function
 */quat.squaredLength=vec4.squaredLength; /**
 * Alias for {@link quat.squaredLength}
 * @function
 */quat.sqrLen=quat.squaredLength; /**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */quat.normalize=vec4.normalize; /**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {mat3} m rotation matrix
 * @returns {quat} out
 * @function
 */quat.fromMat3=function(out,m){ // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
// article "Quaternion Calculus and Fast Animation".
var fTrace=m[0]+m[4]+m[8];var fRoot;if(fTrace>0.0){ // |w| > 1/2, may as well choose w > 1/2
fRoot=Math.sqrt(fTrace+1.0); // 2w
out[3]=0.5*fRoot;fRoot=0.5/fRoot; // 1/(4w)
out[0]=(m[5]-m[7])*fRoot;out[1]=(m[6]-m[2])*fRoot;out[2]=(m[1]-m[3])*fRoot;}else { // |w| <= 1/2
var i=0;if(m[4]>m[0])i=1;if(m[8]>m[i*3+i])i=2;var j=(i+1)%3;var k=(i+2)%3;fRoot=Math.sqrt(m[i*3+i]-m[j*3+j]-m[k*3+k]+1.0);out[i]=0.5*fRoot;fRoot=0.5/fRoot;out[3]=(m[j*3+k]-m[k*3+j])*fRoot;out[j]=(m[j*3+i]+m[i*3+j])*fRoot;out[k]=(m[k*3+i]+m[i*3+k])*fRoot;}return out;}; /**
 * Returns a string representation of a quatenion
 *
 * @param {quat} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */quat.str=function(a){return 'quat('+a[0]+', '+a[1]+', '+a[2]+', '+a[3]+')';};module.exports=quat;},{"./common.js":2,"./mat3.js":5,"./vec3.js":9,"./vec4.js":10}],8:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */var glMatrix=_dereq_("./common.js"); /**
 * @class 2 Dimensional Vector
 * @name vec2
 */var vec2={}; /**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */vec2.create=function(){var out=new glMatrix.ARRAY_TYPE(2);out[0]=0;out[1]=0;return out;}; /**
 * Creates a new vec2 initialized with values from an existing vector
 *
 * @param {vec2} a vector to clone
 * @returns {vec2} a new 2D vector
 */vec2.clone=function(a){var out=new glMatrix.ARRAY_TYPE(2);out[0]=a[0];out[1]=a[1];return out;}; /**
 * Creates a new vec2 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} a new 2D vector
 */vec2.fromValues=function(x,y){var out=new glMatrix.ARRAY_TYPE(2);out[0]=x;out[1]=y;return out;}; /**
 * Copy the values from one vec2 to another
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the source vector
 * @returns {vec2} out
 */vec2.copy=function(out,a){out[0]=a[0];out[1]=a[1];return out;}; /**
 * Set the components of a vec2 to the given values
 *
 * @param {vec2} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} out
 */vec2.set=function(out,x,y){out[0]=x;out[1]=y;return out;}; /**
 * Adds two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */vec2.add=function(out,a,b){out[0]=a[0]+b[0];out[1]=a[1]+b[1];return out;}; /**
 * Subtracts vector b from vector a
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */vec2.subtract=function(out,a,b){out[0]=a[0]-b[0];out[1]=a[1]-b[1];return out;}; /**
 * Alias for {@link vec2.subtract}
 * @function
 */vec2.sub=vec2.subtract; /**
 * Multiplies two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */vec2.multiply=function(out,a,b){out[0]=a[0]*b[0];out[1]=a[1]*b[1];return out;}; /**
 * Alias for {@link vec2.multiply}
 * @function
 */vec2.mul=vec2.multiply; /**
 * Divides two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */vec2.divide=function(out,a,b){out[0]=a[0]/b[0];out[1]=a[1]/b[1];return out;}; /**
 * Alias for {@link vec2.divide}
 * @function
 */vec2.div=vec2.divide; /**
 * Returns the minimum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */vec2.min=function(out,a,b){out[0]=Math.min(a[0],b[0]);out[1]=Math.min(a[1],b[1]);return out;}; /**
 * Returns the maximum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */vec2.max=function(out,a,b){out[0]=Math.max(a[0],b[0]);out[1]=Math.max(a[1],b[1]);return out;}; /**
 * Scales a vec2 by a scalar number
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec2} out
 */vec2.scale=function(out,a,b){out[0]=a[0]*b;out[1]=a[1]*b;return out;}; /**
 * Adds two vec2's after scaling the second operand by a scalar value
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec2} out
 */vec2.scaleAndAdd=function(out,a,b,scale){out[0]=a[0]+b[0]*scale;out[1]=a[1]+b[1]*scale;return out;}; /**
 * Calculates the euclidian distance between two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} distance between a and b
 */vec2.distance=function(a,b){var x=b[0]-a[0],y=b[1]-a[1];return Math.sqrt(x*x+y*y);}; /**
 * Alias for {@link vec2.distance}
 * @function
 */vec2.dist=vec2.distance; /**
 * Calculates the squared euclidian distance between two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} squared distance between a and b
 */vec2.squaredDistance=function(a,b){var x=b[0]-a[0],y=b[1]-a[1];return x*x+y*y;}; /**
 * Alias for {@link vec2.squaredDistance}
 * @function
 */vec2.sqrDist=vec2.squaredDistance; /**
 * Calculates the length of a vec2
 *
 * @param {vec2} a vector to calculate length of
 * @returns {Number} length of a
 */vec2.length=function(a){var x=a[0],y=a[1];return Math.sqrt(x*x+y*y);}; /**
 * Alias for {@link vec2.length}
 * @function
 */vec2.len=vec2.length; /**
 * Calculates the squared length of a vec2
 *
 * @param {vec2} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */vec2.squaredLength=function(a){var x=a[0],y=a[1];return x*x+y*y;}; /**
 * Alias for {@link vec2.squaredLength}
 * @function
 */vec2.sqrLen=vec2.squaredLength; /**
 * Negates the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to negate
 * @returns {vec2} out
 */vec2.negate=function(out,a){out[0]=-a[0];out[1]=-a[1];return out;}; /**
 * Returns the inverse of the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to invert
 * @returns {vec2} out
 */vec2.inverse=function(out,a){out[0]=1.0/a[0];out[1]=1.0/a[1];return out;}; /**
 * Normalize a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to normalize
 * @returns {vec2} out
 */vec2.normalize=function(out,a){var x=a[0],y=a[1];var len=x*x+y*y;if(len>0){ //TODO: evaluate use of glm_invsqrt here?
len=1/Math.sqrt(len);out[0]=a[0]*len;out[1]=a[1]*len;}return out;}; /**
 * Calculates the dot product of two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} dot product of a and b
 */vec2.dot=function(a,b){return a[0]*b[0]+a[1]*b[1];}; /**
 * Computes the cross product of two vec2's
 * Note that the cross product must by definition produce a 3D vector
 *
 * @param {vec3} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec3} out
 */vec2.cross=function(out,a,b){var z=a[0]*b[1]-a[1]*b[0];out[0]=out[1]=0;out[2]=z;return out;}; /**
 * Performs a linear interpolation between two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec2} out
 */vec2.lerp=function(out,a,b,t){var ax=a[0],ay=a[1];out[0]=ax+t*(b[0]-ax);out[1]=ay+t*(b[1]-ay);return out;}; /**
 * Generates a random vector with the given scale
 *
 * @param {vec2} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec2} out
 */vec2.random=function(out,scale){scale=scale||1.0;var r=glMatrix.RANDOM()*2.0*Math.PI;out[0]=Math.cos(r)*scale;out[1]=Math.sin(r)*scale;return out;}; /**
 * Transforms the vec2 with a mat2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat2} m matrix to transform with
 * @returns {vec2} out
 */vec2.transformMat2=function(out,a,m){var x=a[0],y=a[1];out[0]=m[0]*x+m[2]*y;out[1]=m[1]*x+m[3]*y;return out;}; /**
 * Transforms the vec2 with a mat2d
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat2d} m matrix to transform with
 * @returns {vec2} out
 */vec2.transformMat2d=function(out,a,m){var x=a[0],y=a[1];out[0]=m[0]*x+m[2]*y+m[4];out[1]=m[1]*x+m[3]*y+m[5];return out;}; /**
 * Transforms the vec2 with a mat3
 * 3rd vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat3} m matrix to transform with
 * @returns {vec2} out
 */vec2.transformMat3=function(out,a,m){var x=a[0],y=a[1];out[0]=m[0]*x+m[3]*y+m[6];out[1]=m[1]*x+m[4]*y+m[7];return out;}; /**
 * Transforms the vec2 with a mat4
 * 3rd vector component is implicitly '0'
 * 4th vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec2} out
 */vec2.transformMat4=function(out,a,m){var x=a[0],y=a[1];out[0]=m[0]*x+m[4]*y+m[12];out[1]=m[1]*x+m[5]*y+m[13];return out;}; /**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */vec2.forEach=function(){var vec=vec2.create();return function(a,stride,offset,count,fn,arg){var i,l;if(!stride){stride=2;}if(!offset){offset=0;}if(count){l=Math.min(count*stride+offset,a.length);}else {l=a.length;}for(i=offset;i<l;i+=stride){vec[0]=a[i];vec[1]=a[i+1];fn(vec,vec,arg);a[i]=vec[0];a[i+1]=vec[1];}return a;};}(); /**
 * Returns a string representation of a vector
 *
 * @param {vec2} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */vec2.str=function(a){return 'vec2('+a[0]+', '+a[1]+')';};module.exports=vec2;},{"./common.js":2}],9:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */var glMatrix=_dereq_("./common.js"); /**
 * @class 3 Dimensional Vector
 * @name vec3
 */var vec3={}; /**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */vec3.create=function(){var out=new glMatrix.ARRAY_TYPE(3);out[0]=0;out[1]=0;out[2]=0;return out;}; /**
 * Creates a new vec3 initialized with values from an existing vector
 *
 * @param {vec3} a vector to clone
 * @returns {vec3} a new 3D vector
 */vec3.clone=function(a){var out=new glMatrix.ARRAY_TYPE(3);out[0]=a[0];out[1]=a[1];out[2]=a[2];return out;}; /**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */vec3.fromValues=function(x,y,z){var out=new glMatrix.ARRAY_TYPE(3);out[0]=x;out[1]=y;out[2]=z;return out;}; /**
 * Copy the values from one vec3 to another
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the source vector
 * @returns {vec3} out
 */vec3.copy=function(out,a){out[0]=a[0];out[1]=a[1];out[2]=a[2];return out;}; /**
 * Set the components of a vec3 to the given values
 *
 * @param {vec3} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} out
 */vec3.set=function(out,x,y,z){out[0]=x;out[1]=y;out[2]=z;return out;}; /**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */vec3.add=function(out,a,b){out[0]=a[0]+b[0];out[1]=a[1]+b[1];out[2]=a[2]+b[2];return out;}; /**
 * Subtracts vector b from vector a
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */vec3.subtract=function(out,a,b){out[0]=a[0]-b[0];out[1]=a[1]-b[1];out[2]=a[2]-b[2];return out;}; /**
 * Alias for {@link vec3.subtract}
 * @function
 */vec3.sub=vec3.subtract; /**
 * Multiplies two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */vec3.multiply=function(out,a,b){out[0]=a[0]*b[0];out[1]=a[1]*b[1];out[2]=a[2]*b[2];return out;}; /**
 * Alias for {@link vec3.multiply}
 * @function
 */vec3.mul=vec3.multiply; /**
 * Divides two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */vec3.divide=function(out,a,b){out[0]=a[0]/b[0];out[1]=a[1]/b[1];out[2]=a[2]/b[2];return out;}; /**
 * Alias for {@link vec3.divide}
 * @function
 */vec3.div=vec3.divide; /**
 * Returns the minimum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */vec3.min=function(out,a,b){out[0]=Math.min(a[0],b[0]);out[1]=Math.min(a[1],b[1]);out[2]=Math.min(a[2],b[2]);return out;}; /**
 * Returns the maximum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */vec3.max=function(out,a,b){out[0]=Math.max(a[0],b[0]);out[1]=Math.max(a[1],b[1]);out[2]=Math.max(a[2],b[2]);return out;}; /**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */vec3.scale=function(out,a,b){out[0]=a[0]*b;out[1]=a[1]*b;out[2]=a[2]*b;return out;}; /**
 * Adds two vec3's after scaling the second operand by a scalar value
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec3} out
 */vec3.scaleAndAdd=function(out,a,b,scale){out[0]=a[0]+b[0]*scale;out[1]=a[1]+b[1]*scale;out[2]=a[2]+b[2]*scale;return out;}; /**
 * Calculates the euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} distance between a and b
 */vec3.distance=function(a,b){var x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2];return Math.sqrt(x*x+y*y+z*z);}; /**
 * Alias for {@link vec3.distance}
 * @function
 */vec3.dist=vec3.distance; /**
 * Calculates the squared euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} squared distance between a and b
 */vec3.squaredDistance=function(a,b){var x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2];return x*x+y*y+z*z;}; /**
 * Alias for {@link vec3.squaredDistance}
 * @function
 */vec3.sqrDist=vec3.squaredDistance; /**
 * Calculates the length of a vec3
 *
 * @param {vec3} a vector to calculate length of
 * @returns {Number} length of a
 */vec3.length=function(a){var x=a[0],y=a[1],z=a[2];return Math.sqrt(x*x+y*y+z*z);}; /**
 * Alias for {@link vec3.length}
 * @function
 */vec3.len=vec3.length; /**
 * Calculates the squared length of a vec3
 *
 * @param {vec3} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */vec3.squaredLength=function(a){var x=a[0],y=a[1],z=a[2];return x*x+y*y+z*z;}; /**
 * Alias for {@link vec3.squaredLength}
 * @function
 */vec3.sqrLen=vec3.squaredLength; /**
 * Negates the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to negate
 * @returns {vec3} out
 */vec3.negate=function(out,a){out[0]=-a[0];out[1]=-a[1];out[2]=-a[2];return out;}; /**
 * Returns the inverse of the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to invert
 * @returns {vec3} out
 */vec3.inverse=function(out,a){out[0]=1.0/a[0];out[1]=1.0/a[1];out[2]=1.0/a[2];return out;}; /**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to normalize
 * @returns {vec3} out
 */vec3.normalize=function(out,a){var x=a[0],y=a[1],z=a[2];var len=x*x+y*y+z*z;if(len>0){ //TODO: evaluate use of glm_invsqrt here?
len=1/Math.sqrt(len);out[0]=a[0]*len;out[1]=a[1]*len;out[2]=a[2]*len;}return out;}; /**
 * Calculates the dot product of two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} dot product of a and b
 */vec3.dot=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}; /**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */vec3.cross=function(out,a,b){var ax=a[0],ay=a[1],az=a[2],bx=b[0],by=b[1],bz=b[2];out[0]=ay*bz-az*by;out[1]=az*bx-ax*bz;out[2]=ax*by-ay*bx;return out;}; /**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec3} out
 */vec3.lerp=function(out,a,b,t){var ax=a[0],ay=a[1],az=a[2];out[0]=ax+t*(b[0]-ax);out[1]=ay+t*(b[1]-ay);out[2]=az+t*(b[2]-az);return out;}; /**
 * Performs a hermite interpolation with two control points
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {vec3} c the third operand
 * @param {vec3} d the fourth operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec3} out
 */vec3.hermite=function(out,a,b,c,d,t){var factorTimes2=t*t,factor1=factorTimes2*(2*t-3)+1,factor2=factorTimes2*(t-2)+t,factor3=factorTimes2*(t-1),factor4=factorTimes2*(3-2*t);out[0]=a[0]*factor1+b[0]*factor2+c[0]*factor3+d[0]*factor4;out[1]=a[1]*factor1+b[1]*factor2+c[1]*factor3+d[1]*factor4;out[2]=a[2]*factor1+b[2]*factor2+c[2]*factor3+d[2]*factor4;return out;}; /**
 * Performs a bezier interpolation with two control points
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {vec3} c the third operand
 * @param {vec3} d the fourth operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec3} out
 */vec3.bezier=function(out,a,b,c,d,t){var inverseFactor=1-t,inverseFactorTimesTwo=inverseFactor*inverseFactor,factorTimes2=t*t,factor1=inverseFactorTimesTwo*inverseFactor,factor2=3*t*inverseFactorTimesTwo,factor3=3*factorTimes2*inverseFactor,factor4=factorTimes2*t;out[0]=a[0]*factor1+b[0]*factor2+c[0]*factor3+d[0]*factor4;out[1]=a[1]*factor1+b[1]*factor2+c[1]*factor3+d[1]*factor4;out[2]=a[2]*factor1+b[2]*factor2+c[2]*factor3+d[2]*factor4;return out;}; /**
 * Generates a random vector with the given scale
 *
 * @param {vec3} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec3} out
 */vec3.random=function(out,scale){scale=scale||1.0;var r=glMatrix.RANDOM()*2.0*Math.PI;var z=glMatrix.RANDOM()*2.0-1.0;var zScale=Math.sqrt(1.0-z*z)*scale;out[0]=Math.cos(r)*zScale;out[1]=Math.sin(r)*zScale;out[2]=z*scale;return out;}; /**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec3} out
 */vec3.transformMat4=function(out,a,m){var x=a[0],y=a[1],z=a[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];w=w||1.0;out[0]=(m[0]*x+m[4]*y+m[8]*z+m[12])/w;out[1]=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;out[2]=(m[2]*x+m[6]*y+m[10]*z+m[14])/w;return out;}; /**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */vec3.transformMat3=function(out,a,m){var x=a[0],y=a[1],z=a[2];out[0]=x*m[0]+y*m[3]+z*m[6];out[1]=x*m[1]+y*m[4]+z*m[7];out[2]=x*m[2]+y*m[5]+z*m[8];return out;}; /**
 * Transforms the vec3 with a quat
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec3} out
 */vec3.transformQuat=function(out,a,q){ // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations
var x=a[0],y=a[1],z=a[2],qx=q[0],qy=q[1],qz=q[2],qw=q[3], // calculate quat * vec
ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z; // calculate result * inverse quat
out[0]=ix*qw+iw*-qx+iy*-qz-iz*-qy;out[1]=iy*qw+iw*-qy+iz*-qx-ix*-qz;out[2]=iz*qw+iw*-qz+ix*-qy-iy*-qx;return out;}; /**
 * Rotate a 3D vector around the x-axis
 * @param {vec3} out The receiving vec3
 * @param {vec3} a The vec3 point to rotate
 * @param {vec3} b The origin of the rotation
 * @param {Number} c The angle of rotation
 * @returns {vec3} out
 */vec3.rotateX=function(out,a,b,c){var p=[],r=[]; //Translate point to the origin
p[0]=a[0]-b[0];p[1]=a[1]-b[1];p[2]=a[2]-b[2]; //perform rotation
r[0]=p[0];r[1]=p[1]*Math.cos(c)-p[2]*Math.sin(c);r[2]=p[1]*Math.sin(c)+p[2]*Math.cos(c); //translate to correct position
out[0]=r[0]+b[0];out[1]=r[1]+b[1];out[2]=r[2]+b[2];return out;}; /**
 * Rotate a 3D vector around the y-axis
 * @param {vec3} out The receiving vec3
 * @param {vec3} a The vec3 point to rotate
 * @param {vec3} b The origin of the rotation
 * @param {Number} c The angle of rotation
 * @returns {vec3} out
 */vec3.rotateY=function(out,a,b,c){var p=[],r=[]; //Translate point to the origin
p[0]=a[0]-b[0];p[1]=a[1]-b[1];p[2]=a[2]-b[2]; //perform rotation
r[0]=p[2]*Math.sin(c)+p[0]*Math.cos(c);r[1]=p[1];r[2]=p[2]*Math.cos(c)-p[0]*Math.sin(c); //translate to correct position
out[0]=r[0]+b[0];out[1]=r[1]+b[1];out[2]=r[2]+b[2];return out;}; /**
 * Rotate a 3D vector around the z-axis
 * @param {vec3} out The receiving vec3
 * @param {vec3} a The vec3 point to rotate
 * @param {vec3} b The origin of the rotation
 * @param {Number} c The angle of rotation
 * @returns {vec3} out
 */vec3.rotateZ=function(out,a,b,c){var p=[],r=[]; //Translate point to the origin
p[0]=a[0]-b[0];p[1]=a[1]-b[1];p[2]=a[2]-b[2]; //perform rotation
r[0]=p[0]*Math.cos(c)-p[1]*Math.sin(c);r[1]=p[0]*Math.sin(c)+p[1]*Math.cos(c);r[2]=p[2]; //translate to correct position
out[0]=r[0]+b[0];out[1]=r[1]+b[1];out[2]=r[2]+b[2];return out;}; /**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */vec3.forEach=function(){var vec=vec3.create();return function(a,stride,offset,count,fn,arg){var i,l;if(!stride){stride=3;}if(!offset){offset=0;}if(count){l=Math.min(count*stride+offset,a.length);}else {l=a.length;}for(i=offset;i<l;i+=stride){vec[0]=a[i];vec[1]=a[i+1];vec[2]=a[i+2];fn(vec,vec,arg);a[i]=vec[0];a[i+1]=vec[1];a[i+2]=vec[2];}return a;};}(); /**
 * Get the angle between two 3D vectors
 * @param {vec3} a The first operand
 * @param {vec3} b The second operand
 * @returns {Number} The angle in radians
 */vec3.angle=function(a,b){var tempA=vec3.fromValues(a[0],a[1],a[2]);var tempB=vec3.fromValues(b[0],b[1],b[2]);vec3.normalize(tempA,tempA);vec3.normalize(tempB,tempB);var cosine=vec3.dot(tempA,tempB);if(cosine>1.0){return 0;}else {return Math.acos(cosine);}}; /**
 * Returns a string representation of a vector
 *
 * @param {vec3} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */vec3.str=function(a){return 'vec3('+a[0]+', '+a[1]+', '+a[2]+')';};module.exports=vec3;},{"./common.js":2}],10:[function(_dereq_,module,exports){ /* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */var glMatrix=_dereq_("./common.js"); /**
 * @class 4 Dimensional Vector
 * @name vec4
 */var vec4={}; /**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */vec4.create=function(){var out=new glMatrix.ARRAY_TYPE(4);out[0]=0;out[1]=0;out[2]=0;out[3]=0;return out;}; /**
 * Creates a new vec4 initialized with values from an existing vector
 *
 * @param {vec4} a vector to clone
 * @returns {vec4} a new 4D vector
 */vec4.clone=function(a){var out=new glMatrix.ARRAY_TYPE(4);out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];return out;}; /**
 * Creates a new vec4 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} a new 4D vector
 */vec4.fromValues=function(x,y,z,w){var out=new glMatrix.ARRAY_TYPE(4);out[0]=x;out[1]=y;out[2]=z;out[3]=w;return out;}; /**
 * Copy the values from one vec4 to another
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the source vector
 * @returns {vec4} out
 */vec4.copy=function(out,a){out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];return out;}; /**
 * Set the components of a vec4 to the given values
 *
 * @param {vec4} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} out
 */vec4.set=function(out,x,y,z,w){out[0]=x;out[1]=y;out[2]=z;out[3]=w;return out;}; /**
 * Adds two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */vec4.add=function(out,a,b){out[0]=a[0]+b[0];out[1]=a[1]+b[1];out[2]=a[2]+b[2];out[3]=a[3]+b[3];return out;}; /**
 * Subtracts vector b from vector a
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */vec4.subtract=function(out,a,b){out[0]=a[0]-b[0];out[1]=a[1]-b[1];out[2]=a[2]-b[2];out[3]=a[3]-b[3];return out;}; /**
 * Alias for {@link vec4.subtract}
 * @function
 */vec4.sub=vec4.subtract; /**
 * Multiplies two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */vec4.multiply=function(out,a,b){out[0]=a[0]*b[0];out[1]=a[1]*b[1];out[2]=a[2]*b[2];out[3]=a[3]*b[3];return out;}; /**
 * Alias for {@link vec4.multiply}
 * @function
 */vec4.mul=vec4.multiply; /**
 * Divides two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */vec4.divide=function(out,a,b){out[0]=a[0]/b[0];out[1]=a[1]/b[1];out[2]=a[2]/b[2];out[3]=a[3]/b[3];return out;}; /**
 * Alias for {@link vec4.divide}
 * @function
 */vec4.div=vec4.divide; /**
 * Returns the minimum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */vec4.min=function(out,a,b){out[0]=Math.min(a[0],b[0]);out[1]=Math.min(a[1],b[1]);out[2]=Math.min(a[2],b[2]);out[3]=Math.min(a[3],b[3]);return out;}; /**
 * Returns the maximum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */vec4.max=function(out,a,b){out[0]=Math.max(a[0],b[0]);out[1]=Math.max(a[1],b[1]);out[2]=Math.max(a[2],b[2]);out[3]=Math.max(a[3],b[3]);return out;}; /**
 * Scales a vec4 by a scalar number
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec4} out
 */vec4.scale=function(out,a,b){out[0]=a[0]*b;out[1]=a[1]*b;out[2]=a[2]*b;out[3]=a[3]*b;return out;}; /**
 * Adds two vec4's after scaling the second operand by a scalar value
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec4} out
 */vec4.scaleAndAdd=function(out,a,b,scale){out[0]=a[0]+b[0]*scale;out[1]=a[1]+b[1]*scale;out[2]=a[2]+b[2]*scale;out[3]=a[3]+b[3]*scale;return out;}; /**
 * Calculates the euclidian distance between two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} distance between a and b
 */vec4.distance=function(a,b){var x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],w=b[3]-a[3];return Math.sqrt(x*x+y*y+z*z+w*w);}; /**
 * Alias for {@link vec4.distance}
 * @function
 */vec4.dist=vec4.distance; /**
 * Calculates the squared euclidian distance between two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} squared distance between a and b
 */vec4.squaredDistance=function(a,b){var x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],w=b[3]-a[3];return x*x+y*y+z*z+w*w;}; /**
 * Alias for {@link vec4.squaredDistance}
 * @function
 */vec4.sqrDist=vec4.squaredDistance; /**
 * Calculates the length of a vec4
 *
 * @param {vec4} a vector to calculate length of
 * @returns {Number} length of a
 */vec4.length=function(a){var x=a[0],y=a[1],z=a[2],w=a[3];return Math.sqrt(x*x+y*y+z*z+w*w);}; /**
 * Alias for {@link vec4.length}
 * @function
 */vec4.len=vec4.length; /**
 * Calculates the squared length of a vec4
 *
 * @param {vec4} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */vec4.squaredLength=function(a){var x=a[0],y=a[1],z=a[2],w=a[3];return x*x+y*y+z*z+w*w;}; /**
 * Alias for {@link vec4.squaredLength}
 * @function
 */vec4.sqrLen=vec4.squaredLength; /**
 * Negates the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to negate
 * @returns {vec4} out
 */vec4.negate=function(out,a){out[0]=-a[0];out[1]=-a[1];out[2]=-a[2];out[3]=-a[3];return out;}; /**
 * Returns the inverse of the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to invert
 * @returns {vec4} out
 */vec4.inverse=function(out,a){out[0]=1.0/a[0];out[1]=1.0/a[1];out[2]=1.0/a[2];out[3]=1.0/a[3];return out;}; /**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to normalize
 * @returns {vec4} out
 */vec4.normalize=function(out,a){var x=a[0],y=a[1],z=a[2],w=a[3];var len=x*x+y*y+z*z+w*w;if(len>0){len=1/Math.sqrt(len);out[0]=x*len;out[1]=y*len;out[2]=z*len;out[3]=w*len;}return out;}; /**
 * Calculates the dot product of two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} dot product of a and b
 */vec4.dot=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];}; /**
 * Performs a linear interpolation between two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec4} out
 */vec4.lerp=function(out,a,b,t){var ax=a[0],ay=a[1],az=a[2],aw=a[3];out[0]=ax+t*(b[0]-ax);out[1]=ay+t*(b[1]-ay);out[2]=az+t*(b[2]-az);out[3]=aw+t*(b[3]-aw);return out;}; /**
 * Generates a random vector with the given scale
 *
 * @param {vec4} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec4} out
 */vec4.random=function(out,scale){scale=scale||1.0; //TODO: This is a pretty awful way of doing this. Find something better.
out[0]=glMatrix.RANDOM();out[1]=glMatrix.RANDOM();out[2]=glMatrix.RANDOM();out[3]=glMatrix.RANDOM();vec4.normalize(out,out);vec4.scale(out,out,scale);return out;}; /**
 * Transforms the vec4 with a mat4.
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec4} out
 */vec4.transformMat4=function(out,a,m){var x=a[0],y=a[1],z=a[2],w=a[3];out[0]=m[0]*x+m[4]*y+m[8]*z+m[12]*w;out[1]=m[1]*x+m[5]*y+m[9]*z+m[13]*w;out[2]=m[2]*x+m[6]*y+m[10]*z+m[14]*w;out[3]=m[3]*x+m[7]*y+m[11]*z+m[15]*w;return out;}; /**
 * Transforms the vec4 with a quat
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec4} out
 */vec4.transformQuat=function(out,a,q){var x=a[0],y=a[1],z=a[2],qx=q[0],qy=q[1],qz=q[2],qw=q[3], // calculate quat * vec
ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z; // calculate result * inverse quat
out[0]=ix*qw+iw*-qx+iy*-qz-iz*-qy;out[1]=iy*qw+iw*-qy+iz*-qx-ix*-qz;out[2]=iz*qw+iw*-qz+ix*-qy-iy*-qx;out[3]=a[3];return out;}; /**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec4s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */vec4.forEach=function(){var vec=vec4.create();return function(a,stride,offset,count,fn,arg){var i,l;if(!stride){stride=4;}if(!offset){offset=0;}if(count){l=Math.min(count*stride+offset,a.length);}else {l=a.length;}for(i=offset;i<l;i+=stride){vec[0]=a[i];vec[1]=a[i+1];vec[2]=a[i+2];vec[3]=a[i+3];fn(vec,vec,arg);a[i]=vec[0];a[i+1]=vec[1];a[i+2]=vec[2];a[i+3]=vec[3];}return a;};}(); /**
 * Returns a string representation of a vector
 *
 * @param {vec4} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */vec4.str=function(a){return 'vec4('+a[0]+', '+a[1]+', '+a[2]+', '+a[3]+')';};module.exports=vec4;},{"./common.js":2}],11:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}(); // alfrid.js
//	TOOLS
//	CAMERAS
//	LOADERS
//	HELPERS
var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);var _GLTool=_dereq_('./alfrid/GLTool');var _GLTool2=_interopRequireDefault(_GLTool);var _GLShader=_dereq_('./alfrid/GLShader');var _GLShader2=_interopRequireDefault(_GLShader);var _GLTexture=_dereq_('./alfrid/GLTexture');var _GLTexture2=_interopRequireDefault(_GLTexture);var _GLCubeTexture=_dereq_('./alfrid/GLCubeTexture');var _GLCubeTexture2=_interopRequireDefault(_GLCubeTexture);var _Mesh=_dereq_('./alfrid/Mesh');var _Mesh2=_interopRequireDefault(_Mesh);var _Geom=_dereq_('./alfrid/Geom');var _Geom2=_interopRequireDefault(_Geom);var _Batch=_dereq_('./alfrid/Batch');var _Batch2=_interopRequireDefault(_Batch);var _FrameBuffer=_dereq_('./alfrid/FrameBuffer');var _FrameBuffer2=_interopRequireDefault(_FrameBuffer);var _CubeFrameBuffer=_dereq_('./alfrid/CubeFrameBuffer');var _CubeFrameBuffer2=_interopRequireDefault(_CubeFrameBuffer);var _Scheduler=_dereq_('./alfrid/tools/Scheduler');var _Scheduler2=_interopRequireDefault(_Scheduler);var _EventDispatcher=_dereq_('./alfrid/tools/EventDispatcher');var _EventDispatcher2=_interopRequireDefault(_EventDispatcher);var _EaseNumber=_dereq_('./alfrid/tools/EaseNumber');var _EaseNumber2=_interopRequireDefault(_EaseNumber);var _OrbitalControl=_dereq_('./alfrid/tools/OrbitalControl');var _OrbitalControl2=_interopRequireDefault(_OrbitalControl);var _QuatRotation=_dereq_('./alfrid/tools/QuatRotation');var _QuatRotation2=_interopRequireDefault(_QuatRotation);var _Camera=_dereq_('./alfrid/cameras/Camera');var _Camera2=_interopRequireDefault(_Camera);var _CameraOrtho=_dereq_('./alfrid/cameras/CameraOrtho');var _CameraOrtho2=_interopRequireDefault(_CameraOrtho);var _CameraPerspective=_dereq_('./alfrid/cameras/CameraPerspective');var _CameraPerspective2=_interopRequireDefault(_CameraPerspective);var _CameraCube=_dereq_('./alfrid/cameras/CameraCube');var _CameraCube2=_interopRequireDefault(_CameraCube);var _BinaryLoader=_dereq_('./alfrid/loaders/BinaryLoader');var _BinaryLoader2=_interopRequireDefault(_BinaryLoader);var _ObjLoader=_dereq_('./alfrid/loaders/ObjLoader');var _ObjLoader2=_interopRequireDefault(_ObjLoader);var _HDRLoader=_dereq_('./alfrid/loaders/HDRLoader');var _HDRLoader2=_interopRequireDefault(_HDRLoader);var _BatchCopy=_dereq_('./alfrid/helpers/BatchCopy');var _BatchCopy2=_interopRequireDefault(_BatchCopy);var _BatchAxis=_dereq_('./alfrid/helpers/BatchAxis');var _BatchAxis2=_interopRequireDefault(_BatchAxis);var _BatchDotsPlane=_dereq_('./alfrid/helpers/BatchDotsPlane');var _BatchDotsPlane2=_interopRequireDefault(_BatchDotsPlane);var _Scene=_dereq_('./alfrid/helpers/Scene');var _Scene2=_interopRequireDefault(_Scene);var _View=_dereq_('./alfrid/helpers/View');var _View2=_interopRequireDefault(_View);var _ShaderLibs=_dereq_('./alfrid/tools/ShaderLibs');var _ShaderLibs2=_interopRequireDefault(_ShaderLibs);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var VERSION='1.0.0';var alfrid=function(){function alfrid(){_classCallCheck(this,alfrid);this.glm=_glMatrix2.default;this.GL=_GLTool2.default;this.GLTool=_GLTool2.default;this.GLShader=_GLShader2.default;this.GLTexture=_GLTexture2.default;this.GLCubeTexture=_GLCubeTexture2.default;this.Mesh=_Mesh2.default;this.Geom=_Geom2.default;this.Batch=_Batch2.default;this.FrameBuffer=_FrameBuffer2.default;this.CubeFrameBuffer=_CubeFrameBuffer2.default;this.Scheduler=_Scheduler2.default;this.EventDispatcher=_EventDispatcher2.default;this.EaseNumber=_EaseNumber2.default;this.Camera=_Camera2.default;this.CameraOrtho=_CameraOrtho2.default;this.CameraPerspective=_CameraPerspective2.default;this.CameraCube=_CameraCube2.default;this.OrbitalControl=_OrbitalControl2.default;this.QuatRotation=_QuatRotation2.default;this.BinaryLoader=_BinaryLoader2.default;this.ObjLoader=_ObjLoader2.default;this.HDRLoader=_HDRLoader2.default;this.BatchCopy=_BatchCopy2.default;this.BatchAxis=_BatchAxis2.default;this.BatchDotsPlane=_BatchDotsPlane2.default;this.Scene=_Scene2.default;this.View=_View2.default;this.ShaderLibs=_ShaderLibs2.default; //	NOT SUPER SURE I'VE DONE THIS IS A GOOD WAY
for(var s in _glMatrix2.default){if(_glMatrix2.default[s]){window[s]=_glMatrix2.default[s];}} //	TESTING CODES
}_createClass(alfrid,[{key:'log',value:function log(){if(navigator.userAgent.indexOf('Chrome')>-1){console.log('%clib alfrid : VERSION '+VERSION,'background: #193441; color: #FCFFF5');}else {console.log('lib alfrid : VERSION ',VERSION);}console.log('%cClasses : ','color: #193441');for(var s in this){if(this[s]){console.log('%c - '+s,'color: #3E606F');}}}}]);return alfrid;}();var b=new alfrid();module.exports=b;},{"./alfrid/Batch":12,"./alfrid/CubeFrameBuffer":13,"./alfrid/FrameBuffer":14,"./alfrid/GLCubeTexture":15,"./alfrid/GLShader":16,"./alfrid/GLTexture":17,"./alfrid/GLTool":18,"./alfrid/Geom":19,"./alfrid/Mesh":20,"./alfrid/cameras/Camera":21,"./alfrid/cameras/CameraCube":22,"./alfrid/cameras/CameraOrtho":23,"./alfrid/cameras/CameraPerspective":24,"./alfrid/helpers/BatchAxis":25,"./alfrid/helpers/BatchCopy":26,"./alfrid/helpers/BatchDotsPlane":27,"./alfrid/helpers/Scene":28,"./alfrid/helpers/View":29,"./alfrid/loaders/BinaryLoader":30,"./alfrid/loaders/HDRLoader":31,"./alfrid/loaders/ObjLoader":32,"./alfrid/tools/EaseNumber":33,"./alfrid/tools/EventDispatcher":34,"./alfrid/tools/OrbitalControl":36,"./alfrid/tools/QuatRotation":37,"./alfrid/tools/Scheduler":38,"./alfrid/tools/ShaderLibs":39,"gl-matrix":1}],12:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}(); // Batch.js
Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('./GLTool');var _GLTool2=_interopRequireDefault(_GLTool);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var Batch=function(){function Batch(mMesh,mShader){_classCallCheck(this,Batch);this._mesh=mMesh;this._shader=mShader;} //	PUBLIC METHODS
_createClass(Batch,[{key:'draw',value:function draw(){this._shader.bind();_GLTool2.default.draw(this.mesh);} //	GETTER AND SETTER
},{key:'mesh',get:function get(){return this._mesh;}},{key:'shader',get:function get(){return this._shader;}}]);return Batch;}();exports.default=Batch;},{"./GLTool":18}],13:[function(_dereq_,module,exports){ // CubeFrameBuffer.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('./GLTool');var _GLTool2=_interopRequireDefault(_GLTool);var _GLCubeTexture=_dereq_('./GLCubeTexture');var _GLCubeTexture2=_interopRequireDefault(_GLCubeTexture);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var gl=undefined;var CubeFrameBuffer=function(){function CubeFrameBuffer(size){var mParameters=arguments.length<=1||arguments[1]===undefined?{}:arguments[1];_classCallCheck(this,CubeFrameBuffer);gl=_GLTool2.default.gl;this._size=size;this.magFilter=mParameters.magFilter||gl.LINEAR;this.minFilter=mParameters.minFilter||gl.LINEAR;this.wrapS=mParameters.wrapS||gl.CLAMP_TO_EDGE;this.wrapT=mParameters.wrapT||gl.CLAMP_TO_EDGE;this._init();}_createClass(CubeFrameBuffer,[{key:'_init',value:function _init(){this.texture=gl.createTexture();this.glTexture=new _GLCubeTexture2.default(this.texture,{},true);gl.bindTexture(gl.TEXTURE_CUBE_MAP,this.texture);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,this.magFilter);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,this.minFilter);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_S,this.wrapS);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_T,this.wrapT);var targets=[gl.TEXTURE_CUBE_MAP_POSITIVE_X,gl.TEXTURE_CUBE_MAP_NEGATIVE_X,gl.TEXTURE_CUBE_MAP_POSITIVE_Y,gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,gl.TEXTURE_CUBE_MAP_POSITIVE_Z,gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];for(var i=0;i<targets.length;i++){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(targets[i],0,gl.RGBA,this.width,this.height,0,gl.RGBA,gl.FLOAT,null);}this._frameBuffers=[];for(var i=0;i<targets.length;i++){var frameBuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,frameBuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,targets[i],this.texture,0);var status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);if(status!==gl.FRAMEBUFFER_COMPLETE){console.log('gl.checkFramebufferStatus() returned '+status);}this._frameBuffers.push(frameBuffer);} // gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindTexture(gl.TEXTURE_CUBE_MAP,null);}},{key:'bind',value:function bind(mTargetIndex){ // if(Math.random() > .99) console.log('bind :', mTargetIndex, this._frameBuffers[mTargetIndex]);
_GLTool2.default.viewport(0,0,this.width,this.height);gl.bindFramebuffer(gl.FRAMEBUFFER,this._frameBuffers[mTargetIndex]);}},{key:'unbind',value:function unbind(){gl.bindFramebuffer(gl.FRAMEBUFFER,null);_GLTool2.default.viewport(0,0,_GLTool2.default.width,_GLTool2.default.height);} //	TEXTURES
},{key:'getTexture',value:function getTexture(){return this.glTexture;} //	GETTERS AND SETTERS
},{key:'width',get:function get(){return this._size;}},{key:'height',get:function get(){return this._size;}}]);return CubeFrameBuffer;}();exports.default=CubeFrameBuffer;},{"./GLCubeTexture":15,"./GLTool":18}],14:[function(_dereq_,module,exports){ // FrameBuffer.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('./GLTool');var _GLTool2=_interopRequireDefault(_GLTool);var _GLTexture=_dereq_('./GLTexture');var _GLTexture2=_interopRequireDefault(_GLTexture);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var isPowerOfTwo=function isPowerOfTwo(x){return x!==0&&!(x&x-1);};var gl=undefined;var WEBGL_depth_texture=undefined;var FrameBuffer=function(){function FrameBuffer(mWidth,mHeight){var mParameters=arguments.length<=2||arguments[2]===undefined?{}:arguments[2];_classCallCheck(this,FrameBuffer);gl=_GLTool2.default.gl;WEBGL_depth_texture=_GLTool2.default.checkExtension('WEBGL_depth_texture');this.width=mWidth;this.height=mHeight;this.magFilter=mParameters.magFilter||gl.LINEAR;this.minFilter=mParameters.minFilter||gl.LINEAR;this.wrapS=mParameters.wrapS||gl.CLAMP_TO_EDGE;this.wrapT=mParameters.wrapT||gl.CLAMP_TO_EDGE;this.useDepth=mParameters.useDepth||true;this.useStencil=mParameters.useStencil||false;if(!isPowerOfTwo(this.width)||!isPowerOfTwo(this.height)){this.wrapS=this.wrapT=gl.CLAMP_TO_EDGE;if(this.minFilter===gl.LINEAR_MIPMAP_NEAREST){this.minFilter=gl.LINEAR;}}this._init();}_createClass(FrameBuffer,[{key:'_init',value:function _init(){this.texture=gl.createTexture();this.glTexture=new _GLTexture2.default(this.texture,true);this.depthTexture=gl.createTexture();this.glDepthTexture=new _GLTexture2.default(this.depthTexture,true);this.frameBuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.frameBuffer); //	SETUP TEXTURE MIPMAP, WRAP
gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,this.magFilter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,this.minFilter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,this.wrapS);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,this.wrapT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.width,this.height,0,gl.RGBA,gl.FLOAT,null);if(WEBGL_depth_texture){gl.bindTexture(gl.TEXTURE_2D,this.depthTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,this.magFilter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,this.minFilter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,this.wrapS);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,this.wrapT);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT,this.width,this.height,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_SHORT,null);} //	GET COLOUR
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0); //	GET DEPTH
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depthTexture,0);if(this.minFilter===gl.LINEAR_MIPMAP_NEAREST){gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.generateMipmap(gl.TEXTURE_2D);} //	UNBIND
gl.bindTexture(gl.TEXTURE_2D,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);} //	PUBLIC METHODS
},{key:'bind',value:function bind(){_GLTool2.default.viewport(0,0,this.width,this.height);gl.bindFramebuffer(gl.FRAMEBUFFER,this.frameBuffer);}},{key:'unbind',value:function unbind(){gl.bindFramebuffer(gl.FRAMEBUFFER,null);_GLTool2.default.viewport(0,0,_GLTool2.default.width,_GLTool2.default.height);} //	TEXTURES
},{key:'getTexture',value:function getTexture(){return this.glTexture;}},{key:'getDepthTexture',value:function getDepthTexture(){return this.glDepthTexture;} //	MIPMAP FILTER
},{key:'minFilter',value:function minFilter(mValue){if(mValue!==gl.LINEAR&&mValue!==gl.NEAREST&&mValue!==gl.LINEAR_MIPMAP_NEAREST){return this;}this.minFilter=mValue;return this;}},{key:'magFilter',value:function magFilter(mValue){if(mValue!==gl.LINEAR&&mValue!==gl.NEAREST&&mValue!==gl.LINEAR_MIPMAP_NEAREST){return this;}this.magFilter=mValue;return this;} //	WRAP
},{key:'wrapS',value:function wrapS(mValue){if(mValue!==gl.CLAMP_TO_EDGE&&mValue!==gl.REPEAT&&mValue!==gl.MIRRORED_REPEAT){return this;}this.wrapS=mValue;return this;}},{key:'wrapT',value:function wrapT(mValue){if(mValue!==gl.CLAMP_TO_EDGE&&mValue!==gl.REPEAT&&mValue!==gl.MIRRORED_REPEAT){return this;}this.wrapT=mValue;return this;}}]);return FrameBuffer;}();exports.default=FrameBuffer;},{"./GLTexture":17,"./GLTool":18}],15:[function(_dereq_,module,exports){ // GLCubeTexture.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('./GLTool');var _GLTool2=_interopRequireDefault(_GLTool);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var gl=undefined;var GLCubeTexture=function(){function GLCubeTexture(mSource){var mParameters=arguments.length<=1||arguments[1]===undefined?{}:arguments[1];var isCubeTexture=arguments.length<=2||arguments[2]===undefined?false:arguments[2];_classCallCheck(this,GLCubeTexture); // console.log(typeof(mSource));
gl=_GLTool2.default.gl;if(isCubeTexture){this.texture=mSource;return;}this.texture=gl.createTexture();this.magFilter=mParameters.magFilter||gl.LINEAR;this.minFilter=mParameters.minFilter||gl.LINEAR_MIPMAP_NEAREST;this.wrapS=mParameters.wrapS||gl.CLAMP_TO_EDGE;this.wrapT=mParameters.wrapT||gl.CLAMP_TO_EDGE;gl.bindTexture(gl.TEXTURE_CUBE_MAP,this.texture);var targets=[gl.TEXTURE_CUBE_MAP_POSITIVE_X,gl.TEXTURE_CUBE_MAP_NEGATIVE_X,gl.TEXTURE_CUBE_MAP_POSITIVE_Y,gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,gl.TEXTURE_CUBE_MAP_POSITIVE_Z,gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];for(var j=0;j<6;j++){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false); // gl.texImage2D(targets[j], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mSource[j]);	
if(mSource[j].exposure){gl.texImage2D(targets[j],0,gl.RGBA,mSource[j].shape[0],mSource[j].shape[1],0,gl.RGBA,gl.FLOAT,mSource[j].data);}else {gl.texImage2D(targets[j],0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mSource[j]);}gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_S,this.wrapS);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_T,this.wrapT);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,this.magFilter);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,this.minFilter);}gl.generateMipmap(gl.TEXTURE_CUBE_MAP);gl.bindTexture(gl.TEXTURE_CUBE_MAP,null);} //	PUBLIC METHOD
_createClass(GLCubeTexture,[{key:'bind',value:function bind(){var index=arguments.length<=0||arguments[0]===undefined?0:arguments[0];if(!_GLTool2.default.shader){return;}gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_CUBE_MAP,this.texture);gl.uniform1i(_GLTool2.default.shader.uniformTextures[index],index);this._bindIndex=index;}},{key:'unbind',value:function unbind(){gl.bindTexture(gl.TEXTURE_CUBE_MAP,null);}}]);return GLCubeTexture;}();exports.default=GLCubeTexture;},{"./GLTool":18}],16:[function(_dereq_,module,exports){ // GLShader.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('./GLTool');var _GLTool2=_interopRequireDefault(_GLTool);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var addLineNumbers=function addLineNumbers(string){var lines=string.split('\n');for(var i=0;i<lines.length;i++){lines[i]=i+1+': '+lines[i];}return lines.join('\n');};var gl=undefined;var defaultVertexShader="#define GLSLIFY 1\n// basic.vert\n\n#define SHADER_NAME BASIC_VERTEX\n\nprecision highp float;\nattribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\n\nvarying vec2 vTextureCoord;\n\nvoid main(void) {\n    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);\n    vTextureCoord = aTextureCoord;\n}";var defaultFragmentShader="#define GLSLIFY 1\n// basic.frag\n\n#define SHADER_NAME BASIC_FRAGMENT\n\nprecision highp float;\nvarying vec2 vTextureCoord;\nuniform float time;\n// uniform sampler2D texture;\n\nvoid main(void) {\n    gl_FragColor = vec4(vTextureCoord, sin(time) * .5 + .5, 1.0);\n}";var GLShader=function(){function GLShader(){var strVertexShader=arguments.length<=0||arguments[0]===undefined?defaultVertexShader:arguments[0];var strFragmentShader=arguments.length<=1||arguments[1]===undefined?defaultFragmentShader:arguments[1];_classCallCheck(this,GLShader);gl=_GLTool2.default.gl;this.parameters=[];this.uniformValues={};this.uniformTextures=[];if(!strVertexShader){strVertexShader=defaultVertexShader;}if(!strFragmentShader){strFragmentShader=defaultVertexShader;}var vsShader=this._createShaderProgram(strVertexShader,true);var fsShader=this._createShaderProgram(strFragmentShader,false);this._attachShaderProgram(vsShader,fsShader);}_createClass(GLShader,[{key:'bind',value:function bind(){gl.useProgram(this.shaderProgram);_GLTool2.default.useShader(this);this.uniformTextures=[];}},{key:'uniform',value:function uniform(mName,mType,mValue){var hasUniform=false;var oUniform=undefined;for(var i=0;i<this.parameters.length;i++){oUniform=this.parameters[i];if(oUniform.name===mName){oUniform.value=mValue;hasUniform=true;break;}}if(!hasUniform){this.shaderProgram[mName]=gl.getUniformLocation(this.shaderProgram,mName);this.parameters.push({name:mName,type:mType,value:mValue,uniformLoc:this.shaderProgram[mName]});}else {this.shaderProgram[mName]=oUniform.uniformLoc;}if(mType.indexOf('Matrix')===-1){gl[mType](this.shaderProgram[mName],mValue);}else {gl[mType](this.shaderProgram[mName],false,mValue);this.uniformValues[mName]=mValue;}}},{key:'_createShaderProgram',value:function _createShaderProgram(mShaderStr,isVertexShader){var shaderType=isVertexShader?_GLTool2.default.VERTEX_SHADER:_GLTool2.default.FRAGMENT_SHADER;var shader=gl.createShader(shaderType);gl.shaderSource(shader,mShaderStr);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){console.warn('Error in Shader : ',gl.getShaderInfoLog(shader));console.log(addLineNumbers(mShaderStr));return null;}return shader;}},{key:'_attachShaderProgram',value:function _attachShaderProgram(mVertexShader,mFragmentShader){this.shaderProgram=gl.createProgram();gl.attachShader(this.shaderProgram,mVertexShader);gl.attachShader(this.shaderProgram,mFragmentShader);gl.linkProgram(this.shaderProgram);}}]);return GLShader;}();exports.default=GLShader;},{"./GLTool":18}],17:[function(_dereq_,module,exports){ // GLTexture.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('./GLTool');var _GLTool2=_interopRequireDefault(_GLTool);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var isPowerOfTwo=function isPowerOfTwo(x){return x!==0&&!(x&x-1);};var isSourcePowerOfTwo=function isSourcePowerOfTwo(obj){var w=obj.width||obj.videoWidth;var h=obj.height||obj.videoHeight;if(!w||!h){return false;}return isPowerOfTwo(w)&&isPowerOfTwo(h);};var gl=undefined;var GLTexture=function(){function GLTexture(mSource){var isTexture=arguments.length<=1||arguments[1]===undefined?false:arguments[1];var mParameters=arguments.length<=2||arguments[2]===undefined?{}:arguments[2];_classCallCheck(this,GLTexture);gl=_GLTool2.default.gl;if(isTexture){this.texture=mSource;}else {this._mSource=mSource;this.texture=gl.createTexture();this._isVideo=mSource.tagName==='VIDEO';this.magFilter=mParameters.magFilter||gl.LINEAR;this.minFilter=mParameters.minFilter||gl.LINEAR_MIPMAP_NEAREST;this.wrapS=mParameters.wrapS||gl.MIRRORED_REPEAT;this.wrapT=mParameters.wrapT||gl.MIRRORED_REPEAT;var width=mSource.width||mSource.videoWidth;if(width){if(!isSourcePowerOfTwo(mSource)){this.wrapS=this.wrapT=gl.CLAMP_TO_EDGE;if(this.minFilter===gl.LINEAR_MIPMAP_NEAREST){this.minFilter=gl.LINEAR;}}}else {this.wrapS=this.wrapT=gl.CLAMP_TO_EDGE;if(this.minFilter===gl.LINEAR_MIPMAP_NEAREST){this.minFilter=gl.LINEAR;}}gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);if(mSource.exposure){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,mSource.shape[0],mSource.shape[1],0,gl.RGBA,gl.FLOAT,mSource.data);}else {gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mSource);}gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,this.magFilter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,this.minFilter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,this.wrapS);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,this.wrapT);if(this.minFilter===gl.LINEAR_MIPMAP_NEAREST){gl.generateMipmap(gl.TEXTURE_2D);}gl.bindTexture(gl.TEXTURE_2D,null);}} //	MIPMAP FILTER
_createClass(GLTexture,[{key:'minFilter',value:function minFilter(mValue){if(mValue!==gl.LINEAR&&mValue!==gl.NEAREST&&mValue!==gl.LINEAR_MIPMAP_NEAREST){return this;}this.minFilter=mValue;return this;}},{key:'magFilter',value:function magFilter(mValue){if(mValue!==gl.LINEAR&&mValue!==gl.NEAREST&&mValue!==gl.LINEAR_MIPMAP_NEAREST){return this;}this.magFilter=mValue;return this;} //	WRAP
},{key:'wrapS',value:function wrapS(mValue){if(mValue!==gl.CLAMP_TO_EDGE&&mValue!==gl.REPEAT&&mValue!==gl.MIRRORED_REPEAT){return this;}this.wrapS=mValue;return this;}},{key:'wrapT',value:function wrapT(mValue){if(mValue!==gl.CLAMP_TO_EDGE&&mValue!==gl.REPEAT&&mValue!==gl.MIRRORED_REPEAT){return this;}this.wrapT=mValue;return this;} //	UPDATE TEXTURE
},{key:'updateTexture',value:function updateTexture(mSource){if(mSource){this._mSource=mSource;}gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this._mSource);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,this.magFilter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,this.minFilter);if(this.minFilter===gl.LINEAR_MIPMAP_NEAREST){gl.generateMipmap(gl.TEXTURE_2D);}gl.bindTexture(gl.TEXTURE_2D,null);}},{key:'bind',value:function bind(index){if(index===undefined){index=0;}if(!_GLTool2.default.shader){return;}gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(_GLTool2.default.shader.uniformTextures[index],index);this._bindIndex=index;}}]);return GLTexture;}();exports.default=GLTexture;},{"./GLTool":18}],18:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}(); // GLTool.js
Object.defineProperty(exports,"__esModule",{value:true});var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var GLTool=function(){function GLTool(){_classCallCheck(this,GLTool);this.canvas;this._viewport=[0,0,0,0];this._enabledVertexAttribute=[];this.identityMatrix=_glMatrix2.default.mat4.create();this._normalMatrix=_glMatrix2.default.mat3.create();this._inverseModelViewMatrix=_glMatrix2.default.mat3.create();this._modelMatrix=_glMatrix2.default.mat4.create();this._matrix=_glMatrix2.default.mat4.create();_glMatrix2.default.mat4.identity(this.identityMatrix,this.identityMatrix);} //	INITIALIZE
_createClass(GLTool,[{key:'init',value:function init(mCanvas){var mParameters=arguments.length<=1||arguments[1]===undefined?{}:arguments[1];if(this.canvas!==undefined){this.destroy();}this.canvas=mCanvas;this.setSize(window.innerWidth,window.innerHeight);this.gl=this.canvas.getContext('webgl',mParameters)||this.canvas.getContext('experimental-webgl',mParameters); //	extensions
var extensions=['EXT_shader_texture_lod','EXT_shader_texture_lod','EXT_sRGB','EXT_frag_depth','OES_texture_float','OES_texture_half_float','OES_texture_float_linear','OES_texture_half_float_linear','OES_standard_derivatives','WEBGL_depth_texture'];this.extensions={};for(var i=0;i<extensions.length;i++){this.extensions[extensions[i]]=this.gl.getExtension(extensions[i]);} //	Copy gl Attributes
var gl=this.gl;this.VERTEX_SHADER=gl.VERTEX_SHADER;this.FRAGMENT_SHADER=gl.FRAGMENT_SHADER;this.COMPILE_STATUS=gl.COMPILE_STATUS;this.DEPTH_TEST=gl.DEPTH_TEST;this.CULL_FACE=gl.CULL_FACE;this.BLEND=gl.BLEND;this.POINTS=gl.POINTS;this.LINES=gl.LINES;this.TRIANGLES=gl.TRIANGLES;this.LINEAR=gl.LINEAR;this.NEAREST=gl.NEAREST;this.LINEAR_MIPMAP_NEAREST=gl.LINEAR_MIPMAP_NEAREST;this.MIRRORED_REPEAT=gl.MIRRORED_REPEAT;this.CLAMP_TO_EDGE=gl.CLAMP_TO_EDGE;this.enable(this.DEPTH_TEST);this.enable(this.CULL_FACE);this.enable(this.BLEND);} //	PUBLIC METHODS
},{key:'setViewport',value:function setViewport(x,y,w,h){var hasChanged=false;if(x!==this._viewport[0]){hasChanged=true;}if(y!==this._viewport[1]){hasChanged=true;}if(w!==this._viewport[2]){hasChanged=true;}if(h!==this._viewport[3]){hasChanged=true;}if(hasChanged){this.gl.viewport(x,y,w,h);this._viewport=[x,y,w,h];}}},{key:'clear',value:function clear(r,g,b,a){this.gl.clearColor(r,g,b,a);this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);}},{key:'setMatrices',value:function setMatrices(mCamera){this.camera=mCamera;this.rotate(this.identityMatrix);}},{key:'useShader',value:function useShader(mShader){this.shader=mShader;this.shaderProgram=this.shader.shaderProgram;}},{key:'rotate',value:function rotate(mRotation){_glMatrix2.default.mat4.copy(this._modelMatrix,mRotation);_glMatrix2.default.mat4.multiply(this._matrix,this.camera.matrix,this._modelMatrix);_glMatrix2.default.mat3.fromMat4(this._normalMatrix,this._matrix);_glMatrix2.default.mat3.invert(this._normalMatrix,this._normalMatrix);_glMatrix2.default.mat3.transpose(this._normalMatrix,this._normalMatrix);_glMatrix2.default.mat3.fromMat4(this._inverseModelViewMatrix,this._matrix);_glMatrix2.default.mat3.invert(this._inverseModelViewMatrix,this._inverseModelViewMatrix);}},{key:'draw',value:function draw(mMesh){if(mMesh.length){for(var i=0;i<mMesh.length;i++){this.draw(mMesh[i]);}return;}function getAttribLoc(gl,shaderProgram,name){if(shaderProgram.cacheAttribLoc===undefined){shaderProgram.cacheAttribLoc={};}if(shaderProgram.cacheAttribLoc[name]===undefined){shaderProgram.cacheAttribLoc[name]=gl.getAttribLocation(shaderProgram,name);}return shaderProgram.cacheAttribLoc[name];} //	ATTRIBUTES
for(var i=0;i<mMesh.attributes.length;i++){var attribute=mMesh.attributes[i];this.gl.bindBuffer(this.gl.ARRAY_BUFFER,attribute.buffer);var attrPosition=getAttribLoc(this.gl,this.shaderProgram,attribute.name);this.gl.vertexAttribPointer(attrPosition,attribute.itemSize,this.gl.FLOAT,false,0,0);if(this._enabledVertexAttribute.indexOf(attrPosition)===-1){this.gl.enableVertexAttribArray(attrPosition);this._enabledVertexAttribute.push(attrPosition);}} //	BIND INDEX BUFFER
this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,mMesh.iBuffer); //	DEFAULT MATRICES
this.shader.uniform('uProjectionMatrix','uniformMatrix4fv',this.camera.projection);this.shader.uniform('uModelMatrix','uniformMatrix4fv',this._modelMatrix);this.shader.uniform('uViewMatrix','uniformMatrix4fv',this.camera.matrix);this.shader.uniform('uNormalMatrix','uniformMatrix3fv',this._normalMatrix);this.shader.uniform('uModelViewMatrixInverse','uniformMatrix3fv',this._inverseModelViewMatrix); //	DRAWING
if(mMesh.drawType===this.gl.POINTS){this.gl.drawArrays(mMesh.drawType,0,mMesh.vertexSize);}else {this.gl.drawElements(mMesh.drawType,mMesh.iBuffer.numItems,this.gl.UNSIGNED_SHORT,0);}}},{key:'setSize',value:function setSize(mWidth,mHeight){this._width=mWidth;this._height=mHeight;this.canvas.width=this._width;this.canvas.height=this._height;this._aspectRatio=this._width/this._height;if(this.gl){this.viewport(0,0,this._width,this._height);}}},{key:'showExtensions',value:function showExtensions(){console.log('Extensions : ',this.extensions);for(var ext in this.extensions){if(this.extensions[ext]){console.log(ext,':',this.extensions[ext]);}}}},{key:'checkExtension',value:function checkExtension(mExtension){return !!this.extensions[mExtension];}},{key:'getExtension',value:function getExtension(mExtension){return this.extensions[mExtension];} //	BLEND MODES
},{key:'enableAlphaBlending',value:function enableAlphaBlending(){this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA);}},{key:'enableAdditiveBlending',value:function enableAdditiveBlending(){this.gl.blendFunc(this.gl.ONE,this.gl.ONE);} //	GL NATIVE FUNCTIONS
},{key:'enable',value:function enable(mParameter){this.gl.enable(mParameter);}},{key:'disable',value:function disable(mParameter){this.gl.disable(mParameter);}},{key:'viewport',value:function viewport(x,y,w,h){this.setViewport(x,y,w,h);} //	GETTER AND SETTERS
},{key:'destroy', //	DESTROY
value:function destroy(){this.canvas=null;if(this.canvas.parentNode){try{this.canvas.parentNode.removeChild(this.canvas);}catch(e){console.log('Error : ',e);}}}},{key:'width',get:function get(){return this._width;}},{key:'height',get:function get(){return this._height;}},{key:'aspectRatio',get:function get(){return this._aspectRatio;}}]);return GLTool;}();var GL=new GLTool();exports.default=GL;},{"gl-matrix":1}],19:[function(_dereq_,module,exports){ // Geom.js
'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _Mesh=_dereq_('./Mesh');var _Mesh2=_interopRequireDefault(_Mesh);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}var Geom={};Geom.plane=function(width,height,numSegments){var withNormals=arguments.length<=3||arguments[3]===undefined?false:arguments[3];var axis=arguments.length<=4||arguments[4]===undefined?'xy':arguments[4];var drawType=arguments.length<=5||arguments[5]===undefined?4:arguments[5];var positions=[];var coords=[];var indices=[];var normals=[];var gapX=width/numSegments;var gapY=height/numSegments;var gapUV=1/numSegments;var index=0;var sx=-width*0.5;var sy=-height*0.5;for(var i=0;i<numSegments;i++){for(var j=0;j<numSegments;j++){var tx=gapX*i+sx;var ty=gapY*j+sy;if(axis==='xz'){positions.push([tx,0,-ty+gapY]);positions.push([tx+gapX,0,-ty+gapY]);positions.push([tx+gapX,0,-ty]);positions.push([tx,0,-ty]);normals.push([0,1,0]);normals.push([0,1,0]);normals.push([0,1,0]);normals.push([0,1,0]);}else if(axis==='yz'){positions.push([0,tx,ty]);positions.push([0,tx+gapX,ty]);positions.push([0,tx+gapX,ty+gapY]);positions.push([0,tx,ty+gapY]);normals.push([1,0,0]);normals.push([1,0,0]);normals.push([1,0,0]);normals.push([1,0,0]);}else {positions.push([tx,ty,0]);positions.push([tx+gapX,ty,0]);positions.push([tx+gapX,ty+gapY,0]);positions.push([tx,ty+gapY,0]);normals.push([0,0,1]);normals.push([0,0,1]);normals.push([0,0,1]);normals.push([0,0,1]);}var u=i/numSegments;var v=j/numSegments;coords.push([u,v]);coords.push([u+gapUV,v]);coords.push([u+gapUV,v+gapUV]);coords.push([u,v+gapUV]);indices.push(index*4+0);indices.push(index*4+1);indices.push(index*4+2);indices.push(index*4+0);indices.push(index*4+2);indices.push(index*4+3);index++;}}var mesh=new _Mesh2.default(drawType);mesh.bufferVertex(positions);mesh.bufferTexCoords(coords);mesh.bufferIndices(indices);if(withNormals){mesh.bufferNormal(normals);}return mesh;};Geom.sphere=function(size,numSegments){var withNormals=arguments.length<=2||arguments[2]===undefined?false:arguments[2];var isInvert=arguments.length<=3||arguments[3]===undefined?false:arguments[3];var drawType=arguments.length<=4||arguments[4]===undefined?4:arguments[4];var positions=[];var coords=[];var indices=[];var normals=[];var index=0;var gapUV=1/numSegments;var getPosition=function getPosition(i,j){var isNormal=arguments.length<=2||arguments[2]===undefined?false:arguments[2]; //	rx : -90 ~ 90 , ry : 0 ~ 360
var rx=i/numSegments*Math.PI-Math.PI*0.5;var ry=j/numSegments*Math.PI*2;var r=isNormal?1:size;var pos=[];pos[1]=Math.sin(rx)*r;var t=Math.cos(rx)*r;pos[0]=Math.cos(ry)*t;pos[2]=Math.sin(ry)*t;var precision=10000;pos[0]=Math.floor(pos[0]*precision)/precision;pos[1]=Math.floor(pos[1]*precision)/precision;pos[2]=Math.floor(pos[2]*precision)/precision;return pos;};for(var i=0;i<numSegments;i++){for(var j=0;j<numSegments;j++){positions.push(getPosition(i,j));positions.push(getPosition(i+1,j));positions.push(getPosition(i+1,j+1));positions.push(getPosition(i,j+1));if(withNormals){normals.push(getPosition(i,j,true));normals.push(getPosition(i+1,j,true));normals.push(getPosition(i+1,j+1,true));normals.push(getPosition(i,j+1,true));}var u=j/numSegments;var v=i/numSegments;coords.push([1.0-u,v]);coords.push([1.0-u,v+gapUV]);coords.push([1.0-u-gapUV,v+gapUV]);coords.push([1.0-u-gapUV,v]);indices.push(index*4+0);indices.push(index*4+1);indices.push(index*4+2);indices.push(index*4+0);indices.push(index*4+2);indices.push(index*4+3);index++;}}if(isInvert){indices.reverse();}var mesh=new _Mesh2.default(drawType);mesh.bufferVertex(positions);mesh.bufferTexCoords(coords);mesh.bufferIndices(indices);if(withNormals){mesh.bufferNormal(normals);}return mesh;};Geom.cube=function(w,h,d){var withNormals=arguments.length<=3||arguments[3]===undefined?false:arguments[3];var drawType=arguments.length<=4||arguments[4]===undefined?4:arguments[4];h=h||w;d=d||w;var x=w/2;var y=h/2;var z=d/2;var positions=[];var coords=[];var indices=[];var normals=[];var count=0; // BACK
positions.push([-x,y,-z]);positions.push([x,y,-z]);positions.push([x,-y,-z]);positions.push([-x,-y,-z]);normals.push([0,0,-1]);normals.push([0,0,-1]);normals.push([0,0,-1]);normals.push([0,0,-1]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // RIGHT
positions.push([x,y,-z]);positions.push([x,y,z]);positions.push([x,-y,z]);positions.push([x,-y,-z]);normals.push([1,0,0]);normals.push([1,0,0]);normals.push([1,0,0]);normals.push([1,0,0]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // FRONT
positions.push([x,y,z]);positions.push([-x,y,z]);positions.push([-x,-y,z]);positions.push([x,-y,z]);normals.push([0,0,1]);normals.push([0,0,1]);normals.push([0,0,1]);normals.push([0,0,1]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // LEFT
positions.push([-x,y,z]);positions.push([-x,y,-z]);positions.push([-x,-y,-z]);positions.push([-x,-y,z]);normals.push([-1,0,0]);normals.push([-1,0,0]);normals.push([-1,0,0]);normals.push([-1,0,0]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // TOP
positions.push([-x,y,z]);positions.push([x,y,z]);positions.push([x,y,-z]);positions.push([-x,y,-z]);normals.push([0,1,0]);normals.push([0,1,0]);normals.push([0,1,0]);normals.push([0,1,0]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // BOTTOM
positions.push([-x,-y,-z]);positions.push([x,-y,-z]);positions.push([x,-y,z]);positions.push([-x,-y,z]);normals.push([0,-1,0]);normals.push([0,-1,0]);normals.push([0,-1,0]);normals.push([0,-1,0]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++;var mesh=new _Mesh2.default(drawType);mesh.bufferVertex(positions);mesh.bufferTexCoords(coords);mesh.bufferIndices(indices);if(withNormals){mesh.bufferNormal(normals);}return mesh;};Geom.skybox=function(size){var withNormals=arguments.length<=1||arguments[1]===undefined?false:arguments[1];var drawType=arguments.length<=2||arguments[2]===undefined?4:arguments[2];var positions=[];var coords=[];var indices=[];var normals=[];var count=0; // BACK
positions.push([size,size,-size]);positions.push([-size,size,-size]);positions.push([-size,-size,-size]);positions.push([size,-size,-size]);normals.push([0,0,-1]);normals.push([0,0,-1]);normals.push([0,0,-1]);normals.push([0,0,-1]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // RIGHT
positions.push([size,-size,-size]);positions.push([size,-size,size]);positions.push([size,size,size]);positions.push([size,size,-size]);normals.push([1,0,0]);normals.push([1,0,0]);normals.push([1,0,0]);normals.push([1,0,0]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // FRONT
positions.push([-size,size,size]);positions.push([size,size,size]);positions.push([size,-size,size]);positions.push([-size,-size,size]);normals.push([0,0,1]);normals.push([0,0,1]);normals.push([0,0,1]);normals.push([0,0,1]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // LEFT
positions.push([-size,-size,size]);positions.push([-size,-size,-size]);positions.push([-size,size,-size]);positions.push([-size,size,size]);normals.push([-1,0,0]);normals.push([-1,0,0]);normals.push([-1,0,0]);normals.push([-1,0,0]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // TOP
positions.push([size,size,size]);positions.push([-size,size,size]);positions.push([-size,size,-size]);positions.push([size,size,-size]);normals.push([0,1,0]);normals.push([0,1,0]);normals.push([0,1,0]);normals.push([0,1,0]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);count++; // BOTTOM
positions.push([size,-size,-size]);positions.push([-size,-size,-size]);positions.push([-size,-size,size]);positions.push([size,-size,size]);normals.push([0,-1,0]);normals.push([0,-1,0]);normals.push([0,-1,0]);normals.push([0,-1,0]);coords.push([0,0]);coords.push([1,0]);coords.push([1,1]);coords.push([0,1]);indices.push(count*4+0);indices.push(count*4+1);indices.push(count*4+2);indices.push(count*4+0);indices.push(count*4+2);indices.push(count*4+3);var mesh=new _Mesh2.default(drawType);mesh.bufferVertex(positions);mesh.bufferTexCoords(coords);mesh.bufferIndices(indices);if(withNormals){mesh.bufferNormal(normals);}return mesh;};Geom.bigTriangle=function(){var indices=[2,1,0];var positions=[[-1,-1],[-1,4],[4,-1]];var mesh=new _Mesh2.default();mesh.bufferData(positions,'aPosition',2);mesh.bufferIndices(indices);return mesh;};exports.default=Geom;},{"./Mesh":20}],20:[function(_dereq_,module,exports){ // Mesh.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('./GLTool');var _GLTool2=_interopRequireDefault(_GLTool);var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var gl=undefined;var vec3=_glMatrix2.default.vec3;var Mesh=function(){function Mesh(){var mDrawType=arguments.length<=0||arguments[0]===undefined?_GLTool2.default.gl.TRIANGLES:arguments[0];_classCallCheck(this,Mesh);gl=_GLTool2.default.gl;this.drawType=mDrawType;this._attributes=[];this._vertexSize=0;this._vertices=[];this._texCoords=[];this._normals=[];this._faceNormals=[];this._tangents=[];this._indices=[];this._faces=[];}_createClass(Mesh,[{key:'bufferVertex',value:function bufferVertex(mArrayVertices){var isDynamic=arguments.length<=1||arguments[1]===undefined?false:arguments[1];this._vertexSize=mArrayVertices.length;this.bufferData(mArrayVertices,'aVertexPosition',3,isDynamic);this._vertices=mArrayVertices;}},{key:'bufferTexCoords',value:function bufferTexCoords(mArrayTexCoords){var isDynamic=arguments.length<=1||arguments[1]===undefined?false:arguments[1];this.bufferData(mArrayTexCoords,'aTextureCoord',2,isDynamic);this._texCoords=mArrayTexCoords;}},{key:'bufferNormal',value:function bufferNormal(mNormals){var isDynamic=arguments.length<=1||arguments[1]===undefined?false:arguments[1];this.bufferData(mNormals,'aNormal',3,isDynamic);this._normals=mNormals;}},{key:'bufferIndices',value:function bufferIndices(mArrayIndices){var isDynamic=arguments.length<=1||arguments[1]===undefined?false:arguments[1];var drawType=isDynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW;this._indices=mArrayIndices;this.iBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.iBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(mArrayIndices),drawType);this.iBuffer.itemSize=1;this.iBuffer.numItems=mArrayIndices.length;this._indices=mArrayIndices;}},{key:'bufferData',value:function bufferData(mData,mName,mItemSize){var isDynamic=arguments.length<=3||arguments[3]===undefined?false:arguments[3];var index=-1,i=0;var drawType=isDynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW;var bufferData=[];var buffer=undefined,dataArray=undefined; //	Check for existing attributes
for(i=0;i<this._attributes.length;i++){if(this._attributes[i].name===mName){this._attributes[i].data=mData;index=i;break;}} //	flatten buffer data		
for(i=0;i<mData.length;i++){for(var j=0;j<mData[i].length;j++){bufferData.push(mData[i][j]);}}if(index===-1){ //	attribute not exist yet, create new buffer
buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);dataArray=new Float32Array(bufferData);gl.bufferData(gl.ARRAY_BUFFER,dataArray,drawType);this._attributes.push({name:mName,data:mData,itemSize:mItemSize,buffer:buffer,dataArray:dataArray});}else { //	attribute existed, replace with new data
buffer=this._attributes[index].buffer;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);dataArray=this._attributes[index].dataArray;for(i=0;i<bufferData.length;i++){dataArray[i]=bufferData[i];}gl.bufferData(gl.ARRAY_BUFFER,dataArray,drawType);}}},{key:'computeNormals',value:function computeNormals(){var usingFaceNormals=arguments.length<=0||arguments[0]===undefined?false:arguments[0];this._generateFaces();if(usingFaceNormals){this._computeFaceNormals();}else {this._computeVertexNormals();}}},{key:'computeTangents',value:function computeTangents(){} //	PRIVATE METHODS
},{key:'_computeFaceNormals',value:function _computeFaceNormals(){var faceIndex=undefined;var face=undefined;var normals=[];for(var i=0;i<this._indices.length;i+=3){faceIndex=i/3;face=this._faces[faceIndex];var N=face.normal;normals[face.indices[0]]=N;normals[face.indices[1]]=N;normals[face.indices[2]]=N;}this.bufferNormal(normals);}},{key:'_computeVertexNormals',value:function _computeVertexNormals(){ //	loop through all vertices
var sumNormal=vec3.create();var face=undefined;var normals=[];for(var i=0;i<this._vertices.length;i++){vec3.set(sumNormal,0,0,0);for(var j=0;j<this._faces.length;j++){face=this._faces[j]; //	if vertex exist in the face, add the normal to sum normal
if(face.indices.indexOf(i)>=0){sumNormal[0]+=face.normal[0];sumNormal[1]+=face.normal[1];sumNormal[2]+=face.normal[2];}}vec3.normalize(sumNormal,sumNormal);normals.push([sumNormal[0],sumNormal[1],sumNormal[2]]);}this.bufferNormal(normals);}},{key:'_generateFaces',value:function _generateFaces(){var ia=undefined,ib=undefined,ic=undefined;var a=undefined,b=undefined,c=undefined,vba=vec3.create(),vca=vec3.create(),vNormal=vec3.create();for(var i=0;i<this._indices.length;i+=3){ia=this._indices[i];ib=this._indices[i+1];ic=this._indices[i+2];a=vec3.clone(this._vertices[ia]);b=vec3.clone(this._vertices[ib]);c=vec3.clone(this._vertices[ic]);vec3.sub(vba,b,a);vec3.sub(vca,c,a);vec3.cross(vNormal,vba,vca);vec3.normalize(vNormal,vNormal);var N=[vNormal[0],vNormal[1],vNormal[2]];var face={indices:[ia,ib,ic],normal:N};this._faces.push(face);}} //	GETTER AND SETTERS
},{key:'attributes',get:function get(){return this._attributes;}},{key:'vertexSize',get:function get(){return this._vertexSize;}},{key:'hasNormals',get:function get(){if(this._normals.length===0){return false;}return true;}},{key:'hasTangents',get:function get(){if(this._tangents.length===0){return false;}return true;}}]);return Mesh;}();exports.default=Mesh;},{"./GLTool":18,"gl-matrix":1}],21:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}(); // Camera.js
Object.defineProperty(exports,"__esModule",{value:true});var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var Camera=function(){function Camera(){_classCallCheck(this,Camera); //	VIEW MATRIX
this._matrix=_glMatrix2.default.mat4.create(); //	PROJECTION MATRIX
this._projection=_glMatrix2.default.mat4.create(); //	POSITION OF CAMERA
this.position=_glMatrix2.default.vec3.create();}_createClass(Camera,[{key:'lookAt',value:function lookAt(aEye,aCenter,aUp){_glMatrix2.default.vec3.copy(this.position,aEye);_glMatrix2.default.mat4.identity(this._matrix);_glMatrix2.default.mat4.lookAt(this._matrix,aEye,aCenter,aUp);} //	GETTERS
},{key:'matrix',get:function get(){return this._matrix;}},{key:'viewMatrix',get:function get(){return this._matrix;}},{key:'projection',get:function get(){return this._projection;}},{key:'projectionMatrix',get:function get(){return this._projection;}}]);return Camera;}();exports.default=Camera;},{"gl-matrix":1}],22:[function(_dereq_,module,exports){ // CameraCube.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _CameraPerspective2=_dereq_('./CameraPerspective');var _CameraPerspective3=_interopRequireDefault(_CameraPerspective2);var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self,call){if(!self){throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call&&((typeof call==="undefined"?"undefined":_typeof(call))==="object"||typeof call==="function")?call:self;}function _inherits(subClass,superClass){if(typeof superClass!=="function"&&superClass!==null){throw new TypeError("Super expression must either be null or a function, not "+(typeof superClass==="undefined"?"undefined":_typeof(superClass)));}subClass.prototype=Object.create(superClass&&superClass.prototype,{constructor:{value:subClass,enumerable:false,writable:true,configurable:true}});if(superClass)Object.setPrototypeOf?Object.setPrototypeOf(subClass,superClass):subClass.__proto__=superClass;}var vec3=_glMatrix2.default.vec3;var CAMERA_SETTINGS=[[vec3.fromValues(0,0,0),vec3.fromValues(1,0,0),vec3.fromValues(0,-1,0)],[vec3.fromValues(0,0,0),vec3.fromValues(-1,0,0),vec3.fromValues(0,-1,0)],[vec3.fromValues(0,0,0),vec3.fromValues(0,1,0),vec3.fromValues(0,0,1)],[vec3.fromValues(0,0,0),vec3.fromValues(0,-1,0),vec3.fromValues(0,0,-1)],[vec3.fromValues(0,0,0),vec3.fromValues(0,0,1),vec3.fromValues(0,-1,0)],[vec3.fromValues(0,0,0),vec3.fromValues(0,0,-1),vec3.fromValues(0,-1,0)]];var CameraCube=function(_CameraPerspective){_inherits(CameraCube,_CameraPerspective);function CameraCube(){_classCallCheck(this,CameraCube);var _this=_possibleConstructorReturn(this,Object.getPrototypeOf(CameraCube).call(this));_this.setPerspective(Math.PI/2,1,0.1,1000);return _this;}_createClass(CameraCube,[{key:'face',value:function face(mIndex){var o=CAMERA_SETTINGS[mIndex];this.lookAt(o[0],o[1],o[2]);}}]);return CameraCube;}(_CameraPerspective3.default);exports.default=CameraCube;},{"./CameraPerspective":24,"gl-matrix":1}],23:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _Camera2=_dereq_('./Camera');var _Camera3=_interopRequireDefault(_Camera2);var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self,call){if(!self){throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call&&((typeof call==="undefined"?"undefined":_typeof(call))==="object"||typeof call==="function")?call:self;}function _inherits(subClass,superClass){if(typeof superClass!=="function"&&superClass!==null){throw new TypeError("Super expression must either be null or a function, not "+(typeof superClass==="undefined"?"undefined":_typeof(superClass)));}subClass.prototype=Object.create(superClass&&superClass.prototype,{constructor:{value:subClass,enumerable:false,writable:true,configurable:true}});if(superClass)Object.setPrototypeOf?Object.setPrototypeOf(subClass,superClass):subClass.__proto__=superClass;} // CameraOrtho.js
var CameraOrtho=function(_Camera){_inherits(CameraOrtho,_Camera);function CameraOrtho(){_classCallCheck(this,CameraOrtho);var _this=_possibleConstructorReturn(this,Object.getPrototypeOf(CameraOrtho).call(this));var eye=_glMatrix2.default.vec3.clone([0,0,5]);var center=_glMatrix2.default.vec3.create();var up=_glMatrix2.default.vec3.clone([0,-1,0]);_this.lookAt(eye,center,up);_this.ortho(1,-1,1,-1);return _this;}_createClass(CameraOrtho,[{key:'setBoundary',value:function setBoundary(left,right,top,bottom){this.ortho(left,right,top,bottom);}},{key:'ortho',value:function ortho(left,right,top,bottom){this.left=left;this.right=right;this.top=top;this.bottom=bottom;_glMatrix2.default.mat4.ortho(this._projection,left,right,top,bottom,0,10000);}}]);return CameraOrtho;}(_Camera3.default);exports.default=CameraOrtho;},{"./Camera":21,"gl-matrix":1}],24:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _Camera2=_dereq_('./Camera');var _Camera3=_interopRequireDefault(_Camera2);var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self,call){if(!self){throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call&&((typeof call==="undefined"?"undefined":_typeof(call))==="object"||typeof call==="function")?call:self;}function _inherits(subClass,superClass){if(typeof superClass!=="function"&&superClass!==null){throw new TypeError("Super expression must either be null or a function, not "+(typeof superClass==="undefined"?"undefined":_typeof(superClass)));}subClass.prototype=Object.create(superClass&&superClass.prototype,{constructor:{value:subClass,enumerable:false,writable:true,configurable:true}});if(superClass)Object.setPrototypeOf?Object.setPrototypeOf(subClass,superClass):subClass.__proto__=superClass;} // CameraPerspective.js
var CameraPerspective=function(_Camera){_inherits(CameraPerspective,_Camera);function CameraPerspective(){_classCallCheck(this,CameraPerspective);return _possibleConstructorReturn(this,Object.getPrototypeOf(CameraPerspective).call(this));}_createClass(CameraPerspective,[{key:'setPerspective',value:function setPerspective(mFov,mAspectRatio,mNear,mFar){this._fov=mFov;this._near=mNear;this._far=mFar;this._aspectRatio=mAspectRatio;_glMatrix2.default.mat4.perspective(this._projection,mFov,mAspectRatio,mNear,mFar);}},{key:'setAspectRatio',value:function setAspectRatio(mAspectRatio){this._aspectRatio=mAspectRatio;_glMatrix2.default.mat4.perspective(this.projection,this._fov,mAspectRatio,this._near,this._far);}}]);return CameraPerspective;}(_Camera3.default);exports.default=CameraPerspective;},{"./Camera":21,"gl-matrix":1}],25:[function(_dereq_,module,exports){'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('../GLTool');var _GLTool2=_interopRequireDefault(_GLTool);var _Mesh=_dereq_('../Mesh');var _Mesh2=_interopRequireDefault(_Mesh);var _GLShader=_dereq_('../GLShader');var _GLShader2=_interopRequireDefault(_GLShader);var _Batch2=_dereq_('../Batch');var _Batch3=_interopRequireDefault(_Batch2);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self,call){if(!self){throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call&&((typeof call==="undefined"?"undefined":_typeof(call))==="object"||typeof call==="function")?call:self;}function _inherits(subClass,superClass){if(typeof superClass!=="function"&&superClass!==null){throw new TypeError("Super expression must either be null or a function, not "+(typeof superClass==="undefined"?"undefined":_typeof(superClass)));}subClass.prototype=Object.create(superClass&&superClass.prototype,{constructor:{value:subClass,enumerable:false,writable:true,configurable:true}});if(superClass)Object.setPrototypeOf?Object.setPrototypeOf(subClass,superClass):subClass.__proto__=superClass;} // BatchAxis.js
var BatchAxis=function(_Batch){_inherits(BatchAxis,_Batch);function BatchAxis(){_classCallCheck(this,BatchAxis);var positions=[];var colors=[];var indices=[0,1,2,3,4,5];var r=9999;positions.push([-r,0,0]);positions.push([r,0,0]);positions.push([0,-r,0]);positions.push([0,r,0]);positions.push([0,0,-r]);positions.push([0,0,r]);colors.push([1,0,0]);colors.push([1,0,0]);colors.push([0,1,0]);colors.push([0,1,0]);colors.push([0,0,1]);colors.push([0,0,1]);var mesh=new _Mesh2.default(_GLTool2.default.LINES);mesh.bufferVertex(positions);mesh.bufferIndices(indices);mesh.bufferData(colors,'aColor',3);var shader=new _GLShader2.default("#define GLSLIFY 1\n// axis.vert\n\n#define SHADER_NAME BASIC_VERTEX\n\nprecision highp float;\nattribute vec3 aVertexPosition;\nattribute vec3 aColor;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\n\nvarying vec3 vColor;\n\nvoid main(void) {\n    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);\n    vColor = aColor;\n}","#define GLSLIFY 1\n// axis.frag\n\n#define SHADER_NAME SIMPLE_TEXTURE\n\nprecision highp float;\nvarying vec3 vColor;\n\nvoid main(void) {\n    gl_FragColor = vec4(vColor, 1.0);\n}");return _possibleConstructorReturn(this,Object.getPrototypeOf(BatchAxis).call(this,mesh,shader));}return BatchAxis;}(_Batch3.default);exports.default=BatchAxis;},{"../Batch":12,"../GLShader":16,"../GLTool":18,"../Mesh":20}],26:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();var _get=function get(object,property,receiver){if(object===null)object=Function.prototype;var desc=Object.getOwnPropertyDescriptor(object,property);if(desc===undefined){var parent=Object.getPrototypeOf(object);if(parent===null){return undefined;}else {return get(parent,property,receiver);}}else if("value" in desc){return desc.value;}else {var getter=desc.get;if(getter===undefined){return undefined;}return getter.call(receiver);}};Object.defineProperty(exports,"__esModule",{value:true});var _Geom=_dereq_('../Geom');var _Geom2=_interopRequireDefault(_Geom);var _GLShader=_dereq_('../GLShader');var _GLShader2=_interopRequireDefault(_GLShader);var _Batch2=_dereq_('../Batch');var _Batch3=_interopRequireDefault(_Batch2);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self,call){if(!self){throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call&&((typeof call==="undefined"?"undefined":_typeof(call))==="object"||typeof call==="function")?call:self;}function _inherits(subClass,superClass){if(typeof superClass!=="function"&&superClass!==null){throw new TypeError("Super expression must either be null or a function, not "+(typeof superClass==="undefined"?"undefined":_typeof(superClass)));}subClass.prototype=Object.create(superClass&&superClass.prototype,{constructor:{value:subClass,enumerable:false,writable:true,configurable:true}});if(superClass)Object.setPrototypeOf?Object.setPrototypeOf(subClass,superClass):subClass.__proto__=superClass;} // BatchCopy.js
var BatchCopy=function(_Batch){_inherits(BatchCopy,_Batch);function BatchCopy(){_classCallCheck(this,BatchCopy);var mesh=_Geom2.default.bigTriangle();var shader=new _GLShader2.default("#define GLSLIFY 1\n// bigTriangle.vert\n\n#define SHADER_NAME BIG_TRIANGLE_VERTEX\n\nprecision highp float;\nattribute vec2 aPosition;\nvarying vec2 vTextureCoord;\n\nvoid main(void) {\n    gl_Position = vec4(aPosition, 0.0, 1.0);\n    vTextureCoord = aPosition * .5 + .5;\n}","#define GLSLIFY 1\n// copy.frag\n\n#define SHADER_NAME COPY_FRAGMENT\n\nprecision highp float;\n\nvarying vec2 vTextureCoord;\nuniform sampler2D texture;\n\nvoid main(void) {\n    gl_FragColor = texture2D(texture, vTextureCoord);\n}");var _this=_possibleConstructorReturn(this,Object.getPrototypeOf(BatchCopy).call(this,mesh,shader));shader.bind();shader.uniform('texture','uniform1i',0);return _this;}_createClass(BatchCopy,[{key:'draw',value:function draw(texture){this.shader.bind();texture.bind(0);_get(Object.getPrototypeOf(BatchCopy.prototype),'draw',this).call(this);}}]);return BatchCopy;}(_Batch3.default);exports.default=BatchCopy;},{"../Batch":12,"../GLShader":16,"../Geom":19}],27:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();var _get=function get(object,property,receiver){if(object===null)object=Function.prototype;var desc=Object.getOwnPropertyDescriptor(object,property);if(desc===undefined){var parent=Object.getPrototypeOf(object);if(parent===null){return undefined;}else {return get(parent,property,receiver);}}else if("value" in desc){return desc.value;}else {var getter=desc.get;if(getter===undefined){return undefined;}return getter.call(receiver);}};Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('../GLTool');var _GLTool2=_interopRequireDefault(_GLTool);var _Mesh=_dereq_('../Mesh');var _Mesh2=_interopRequireDefault(_Mesh);var _GLShader=_dereq_('../GLShader');var _GLShader2=_interopRequireDefault(_GLShader);var _Batch2=_dereq_('../Batch');var _Batch3=_interopRequireDefault(_Batch2);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self,call){if(!self){throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call&&((typeof call==="undefined"?"undefined":_typeof(call))==="object"||typeof call==="function")?call:self;}function _inherits(subClass,superClass){if(typeof superClass!=="function"&&superClass!==null){throw new TypeError("Super expression must either be null or a function, not "+(typeof superClass==="undefined"?"undefined":_typeof(superClass)));}subClass.prototype=Object.create(superClass&&superClass.prototype,{constructor:{value:subClass,enumerable:false,writable:true,configurable:true}});if(superClass)Object.setPrototypeOf?Object.setPrototypeOf(subClass,superClass):subClass.__proto__=superClass;} // BatchDotsPlane.js
var BatchDotsPlane=function(_Batch){_inherits(BatchDotsPlane,_Batch);function BatchDotsPlane(){_classCallCheck(this,BatchDotsPlane);var positions=[];var indices=[];var index=0;var numDots=100;var size=50;var gap=size/numDots;var i=undefined,j=undefined;for(i=-size/2;i<size;i+=gap){for(j=-size/2;j<size;j+=gap){positions.push([i,j,0]);indices.push(index);index++;positions.push([i,0,j]);indices.push(index);index++;}}var mesh=new _Mesh2.default(_GLTool2.default.POINTS);mesh.bufferVertex(positions);mesh.bufferIndices(indices);var shader=new _GLShader2.default("#define GLSLIFY 1\n// basic.vert\n\n#define SHADER_NAME DOTS_PLANE_VERTEX\n\nprecision highp float;\nattribute vec3 aVertexPosition;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\n\nvoid main(void) {\n    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);\n}","#define GLSLIFY 1\n// simpleColor.frag\n\n#define SHADER_NAME SIMPLE_COLOR\n\nprecision highp float;\n\nuniform vec3 color;\nuniform float opacity;\n\nvoid main(void) {\n    gl_FragColor = vec4(color, opacity);\n}");var _this=_possibleConstructorReturn(this,Object.getPrototypeOf(BatchDotsPlane).call(this,mesh,shader));_this.color=[1,1,1];_this.opacity=0.5;return _this;}_createClass(BatchDotsPlane,[{key:'draw',value:function draw(){this.shader.bind();this.shader.uniform('color','uniform3fv',this.color);this.shader.uniform('opacity','uniform1f',this.opacity); // GL.draw(this.mesh);
_get(Object.getPrototypeOf(BatchDotsPlane.prototype),'draw',this).call(this);}}]);return BatchDotsPlane;}(_Batch3.default);exports.default=BatchDotsPlane;},{"../Batch":12,"../GLShader":16,"../GLTool":18,"../Mesh":20}],28:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}(); // Scene.js
Object.defineProperty(exports,"__esModule",{value:true});var _GLTool=_dereq_('../GLTool');var _GLTool2=_interopRequireDefault(_GLTool);var _Scheduler=_dereq_('../tools/Scheduler');var _Scheduler2=_interopRequireDefault(_Scheduler);var _CameraPerspective=_dereq_('../cameras/CameraPerspective');var _CameraPerspective2=_interopRequireDefault(_CameraPerspective);var _CameraOrtho=_dereq_('../cameras/CameraOrtho');var _CameraOrtho2=_interopRequireDefault(_CameraOrtho);var _OrbitalControl=_dereq_('../tools/OrbitalControl');var _OrbitalControl2=_interopRequireDefault(_OrbitalControl);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var Scene=function(){function Scene(){var _this=this;_classCallCheck(this,Scene);this._init();this._initTextures();this._initViews();this._efIndex=_Scheduler2.default.addEF(function(){return _this._loop();});window.addEventListener('resize',function(){return _this.resize();});} //	PUBLIC METHODS
_createClass(Scene,[{key:'render',value:function render(){}},{key:'stop',value:function stop(){if(this._efIndex===-1){return;}this._efIndex=_Scheduler2.default.removeEF(this._efIndex);}},{key:'start',value:function start(){var _this2=this;if(this._efIndex!==-1){return;}this._efIndex=_Scheduler2.default.addEF(function(){return _this2._loop();});}},{key:'resize',value:function resize(){_GLTool2.default.setSize(window.innerWidth,window.innerHeight);this.camera.setAspectRatio(_GLTool2.default.aspectRatio);} //	PROTECTED METHODS TO BE OVERRIDEN BY CHILDREN
},{key:'_initTextures',value:function _initTextures(){}},{key:'_initViews',value:function _initViews(){} //	PRIVATE METHODS
},{key:'_init',value:function _init(){this.camera=new _CameraPerspective2.default();this.camera.setPerspective(45*Math.PI/180,_GLTool2.default.aspectRatio,0.1,100);this.orbitalControl=new _OrbitalControl2.default(this.camera,window,15);this.orbitalControl.radius.value=10;this.cameraOrtho=new _CameraOrtho2.default();}},{key:'_loop',value:function _loop(){ //	RESET VIEWPORT
_GLTool2.default.viewport(0,0,_GLTool2.default.width,_GLTool2.default.height); //	RESET CAMERA
_GLTool2.default.setMatrices(this.camera);this.render();}}]);return Scene;}();exports.default=Scene;},{"../GLTool":18,"../cameras/CameraOrtho":23,"../cameras/CameraPerspective":24,"../tools/OrbitalControl":36,"../tools/Scheduler":38}],29:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}(); // View.js
Object.defineProperty(exports,"__esModule",{value:true});var _GLShader=_dereq_('../GLShader');var _GLShader2=_interopRequireDefault(_GLShader);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var View=function(){function View(mStrVertex,mStrFrag){_classCallCheck(this,View);this.shader=new _GLShader2.default(mStrVertex,mStrFrag);this._init();} //	PROTECTED METHODS
_createClass(View,[{key:'_init',value:function _init(){} // 	PUBLIC METHODS
},{key:'render',value:function render(){}}]);return View;}();exports.default=View;},{"../GLShader":16}],30:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}} // BinaryLoader.js
var BinaryLoader=function(){function BinaryLoader(){var _this=this;var isArrayBuffer=arguments.length<=0||arguments[0]===undefined?false:arguments[0];_classCallCheck(this,BinaryLoader);this._req=new XMLHttpRequest();this._req.addEventListener('load',function(e){return _this._onLoaded(e);});this._req.addEventListener('progress',function(e){return _this._onProgress(e);});if(isArrayBuffer){this._req.responseType='arraybuffer';}}_createClass(BinaryLoader,[{key:'load',value:function load(url,callback){console.log('Loading : ',url);this._callback=callback;this._req.open('GET',url);this._req.send();}},{key:'_onLoaded',value:function _onLoaded(){this._callback(this._req.response);}},{key:'_onProgress',value:function _onProgress() /*e*/{ // console.log('on Progress:', (e.loaded/e.total*100).toFixed(2));
}}]);return BinaryLoader;}();exports.default=BinaryLoader;},{}],31:[function(_dereq_,module,exports){ // HDRLoader.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _BinaryLoader2=_dereq_('./BinaryLoader');var _BinaryLoader3=_interopRequireDefault(_BinaryLoader2);var _HDRParser=_dereq_('../tools/HDRParser');var _HDRParser2=_interopRequireDefault(_HDRParser);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self,call){if(!self){throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call&&((typeof call==="undefined"?"undefined":_typeof(call))==="object"||typeof call==="function")?call:self;}function _inherits(subClass,superClass){if(typeof superClass!=="function"&&superClass!==null){throw new TypeError("Super expression must either be null or a function, not "+(typeof superClass==="undefined"?"undefined":_typeof(superClass)));}subClass.prototype=Object.create(superClass&&superClass.prototype,{constructor:{value:subClass,enumerable:false,writable:true,configurable:true}});if(superClass)Object.setPrototypeOf?Object.setPrototypeOf(subClass,superClass):subClass.__proto__=superClass;}var HDRLoader=function(_BinaryLoader){_inherits(HDRLoader,_BinaryLoader);function HDRLoader(){_classCallCheck(this,HDRLoader);return _possibleConstructorReturn(this,Object.getPrototypeOf(HDRLoader).call(this,true));}_createClass(HDRLoader,[{key:'parse',value:function parse(mArrayBuffer){return (0,_HDRParser2.default)(mArrayBuffer);}},{key:'_onLoaded',value:function _onLoaded(){var o=this.parse(this._req.response);if(this._callback){this._callback(o);}}}]);return HDRLoader;}(_BinaryLoader3.default);HDRLoader.parse=function(mArrayBuffer){return (0,_HDRParser2.default)(mArrayBuffer);};exports.default=HDRLoader;},{"../tools/HDRParser":35,"./BinaryLoader":30}],32:[function(_dereq_,module,exports){ // ObjLoader.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();var _get=function get(object,property,receiver){if(object===null)object=Function.prototype;var desc=Object.getOwnPropertyDescriptor(object,property);if(desc===undefined){var parent=Object.getPrototypeOf(object);if(parent===null){return undefined;}else {return get(parent,property,receiver);}}else if("value" in desc){return desc.value;}else {var getter=desc.get;if(getter===undefined){return undefined;}return getter.call(receiver);}};Object.defineProperty(exports,"__esModule",{value:true});var _BinaryLoader2=_dereq_('./BinaryLoader');var _BinaryLoader3=_interopRequireDefault(_BinaryLoader2);var _Mesh=_dereq_('../Mesh');var _Mesh2=_interopRequireDefault(_Mesh);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self,call){if(!self){throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call&&((typeof call==="undefined"?"undefined":_typeof(call))==="object"||typeof call==="function")?call:self;}function _inherits(subClass,superClass){if(typeof superClass!=="function"&&superClass!==null){throw new TypeError("Super expression must either be null or a function, not "+(typeof superClass==="undefined"?"undefined":_typeof(superClass)));}subClass.prototype=Object.create(superClass&&superClass.prototype,{constructor:{value:subClass,enumerable:false,writable:true,configurable:true}});if(superClass)Object.setPrototypeOf?Object.setPrototypeOf(subClass,superClass):subClass.__proto__=superClass;}var ObjLoader=function(_BinaryLoader){_inherits(ObjLoader,_BinaryLoader);function ObjLoader(){_classCallCheck(this,ObjLoader);return _possibleConstructorReturn(this,Object.getPrototypeOf(ObjLoader).call(this));}_createClass(ObjLoader,[{key:'load',value:function load(url,callback){var ignoreNormals=arguments.length<=2||arguments[2]===undefined?true:arguments[2];var drawType=arguments.length<=3||arguments[3]===undefined?4:arguments[3];this._ignoreNormals=ignoreNormals;this._drawType=drawType;_get(Object.getPrototypeOf(ObjLoader.prototype),'load',this).call(this,url,callback);}},{key:'_onLoaded',value:function _onLoaded(){this._parseObj(this._req.response);}},{key:'_parseObj',value:function _parseObj(objStr){var lines=objStr.split('\n');var positions=[];var coords=[];var finalNormals=[];var vertices=[];var normals=[];var uvs=[];var indices=[];var count=0;var result=undefined; // v float float float
var vertex_pattern=/v( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/; // vn float float float
var normal_pattern=/vn( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/; // vt float float
var uv_pattern=/vt( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/; // f vertex vertex vertex ...
var face_pattern1=/f( +-?\d+)( +-?\d+)( +-?\d+)( +-?\d+)?/; // f vertex/uv vertex/uv vertex/uv ...
var face_pattern2=/f( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))?/; // f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...
var face_pattern3=/f( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))?/; // f vertex//normal vertex//normal vertex//normal ...
var face_pattern4=/f( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))?/;function parseVertexIndex(value){var index=parseInt(value);return (index>=0?index-1:index+vertices.length/3)*3;}function parseNormalIndex(value){var index=parseInt(value);return (index>=0?index-1:index+normals.length/3)*3;}function parseUVIndex(value){var index=parseInt(value);return (index>=0?index-1:index+uvs.length/2)*2;}function addVertex(a,b,c){positions.push([vertices[a],vertices[a+1],vertices[a+2]]);positions.push([vertices[b],vertices[b+1],vertices[b+2]]);positions.push([vertices[c],vertices[c+1],vertices[c+2]]);indices.push(count*3+0);indices.push(count*3+1);indices.push(count*3+2);count++;}function addUV(a,b,c){coords.push([uvs[a],uvs[a+1]]);coords.push([uvs[b],uvs[b+1]]);coords.push([uvs[c],uvs[c+1]]);}function addNormal(a,b,c){finalNormals.push([normals[a],normals[a+1],normals[a+2]]);finalNormals.push([normals[b],normals[b+1],normals[b+2]]);finalNormals.push([normals[c],normals[c+1],normals[c+2]]);}function addFace(a,b,c,d,ua,ub,uc,ud,na,nb,nc,nd){var ia=parseVertexIndex(a);var ib=parseVertexIndex(b);var ic=parseVertexIndex(c);var id=undefined;if(d===undefined){addVertex(ia,ib,ic);}else {id=parseVertexIndex(d);addVertex(ia,ib,id);addVertex(ib,ic,id);}if(ua!==undefined){ia=parseUVIndex(ua);ib=parseUVIndex(ub);ic=parseUVIndex(uc);if(d===undefined){addUV(ia,ib,ic);}else {id=parseUVIndex(ud);addUV(ia,ib,id);addUV(ib,ic,id);}}if(na!==undefined){ia=parseNormalIndex(na);ib=parseNormalIndex(nb);ic=parseNormalIndex(nc);if(d===undefined){addNormal(ia,ib,ic);}else {id=parseNormalIndex(nd);addNormal(ia,ib,id);addNormal(ib,ic,id);}}}for(var i=0;i<lines.length;i++){var line=lines[i];line=line.trim();if(line.length===0||line.charAt(0)==='#'){continue;}else if((result=vertex_pattern.exec(line))!==null){vertices.push(parseFloat(result[1]),parseFloat(result[2]),parseFloat(result[3]));}else if((result=normal_pattern.exec(line))!==null){normals.push(parseFloat(result[1]),parseFloat(result[2]),parseFloat(result[3]));}else if((result=uv_pattern.exec(line))!==null){uvs.push(parseFloat(result[1]),parseFloat(result[2]));}else if((result=face_pattern1.exec(line))!==null){addFace(result[1],result[2],result[3],result[4]);}else if((result=face_pattern2.exec(line))!==null){addFace(result[2],result[5],result[8],result[11],result[3],result[6],result[9],result[12]);}else if((result=face_pattern3.exec(line))!==null){addFace(result[2],result[6],result[10],result[14],result[3],result[7],result[11],result[15],result[4],result[8],result[12],result[16]);}else if((result=face_pattern4.exec(line))!==null){addFace(result[2],result[5],result[8],result[11],undefined,undefined,undefined,undefined,result[3],result[6],result[9],result[12]);}}this._generateMeshes({positions:positions,coords:coords,normals:finalNormals,indices:indices});}},{key:'_generateMeshes',value:function _generateMeshes(o){var maxNumVertices=65535;if(o.positions.length>maxNumVertices){var meshes=[];var lastIndex=0;var oCopy={};oCopy.positions=o.positions.concat();oCopy.coords=o.coords.concat();oCopy.indices=o.indices.concat();oCopy.normals=o.normals.concat();while(o.indices.length>0){var sliceNum=Math.min(maxNumVertices,o.positions.length);var indices=o.indices.splice(0,sliceNum);var positions=[];var coords=[];var normals=[];var index=undefined,tmpIndex=0;for(var i=0;i<indices.length;i++){if(indices[i]>tmpIndex){tmpIndex=indices[i];}index=indices[i];positions.push(oCopy.positions[index]);coords.push(oCopy.coords[index]);normals.push(oCopy.normals[index]);indices[i]-=lastIndex;}lastIndex=tmpIndex+1;var mesh=new _Mesh2.default(this._drawType);mesh.bufferVertex(positions);mesh.bufferTexCoords(coords);mesh.bufferIndices(indices);if(!this._ignoreNormals){mesh.bufferNormal(normals);}meshes.push(mesh);}if(this._callback){this._callback(meshes,oCopy);}}else {var mesh=new _Mesh2.default(this._drawType);mesh.bufferVertex(o.positions);mesh.bufferTexCoords(o.coords);mesh.bufferIndices(o.indices);if(!this._ignoreNormals){mesh.bufferNormal(o.normals);}if(this._callback){this._callback(mesh,o);}}}}]);return ObjLoader;}(_BinaryLoader3.default);exports.default=ObjLoader;},{"../Mesh":20,"./BinaryLoader":30}],33:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}(); // EaseNumber.js
Object.defineProperty(exports,"__esModule",{value:true});var _Scheduler=_dereq_('./Scheduler');var _Scheduler2=_interopRequireDefault(_Scheduler);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var EaseNumber=function(){function EaseNumber(mValue){var _this=this;var mEasing=arguments.length<=1||arguments[1]===undefined?0.1:arguments[1];_classCallCheck(this,EaseNumber);this.easing=mEasing;this._value=mValue;this._targetValue=mValue;_Scheduler2.default.addEF(function(){return _this._update();});}_createClass(EaseNumber,[{key:'_update',value:function _update(){this._checkLimit();this._value+=(this._targetValue-this._value)*this.easing;}},{key:'setTo',value:function setTo(mValue){this._targetValue=this._value=mValue;}},{key:'add',value:function add(mAdd){this._targetValue+=mAdd;}},{key:'limit',value:function limit(mMin,mMax){if(mMin>mMax){this.limit(mMax,mMin);return;}this._min=mMin;this._max=mMax;this._checkLimit();}},{key:'_checkLimit',value:function _checkLimit(){if(this._min!==undefined&&this._targetValue<this._min){this._targetValue=this._min;}if(this._max!==undefined&&this._targetValue>this._max){this._targetValue=this._max;}} //	GETTERS / SETTERS
},{key:'value',set:function set(mValue){this._targetValue=mValue;},get:function get(){return this._value;}},{key:'targetValue',get:function get(){return this._targetValue;}}]);return EaseNumber;}();exports.default=EaseNumber;},{"./Scheduler":38}],34:[function(_dereq_,module,exports){'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}} // EventDispatcher.js
var supportsCustomEvents=true;try{var newTestCustomEvent=document.createEvent('CustomEvent');newTestCustomEvent=null;}catch(e){supportsCustomEvents=false;}var EventDispatcher=function(){function EventDispatcher(){_classCallCheck(this,EventDispatcher);}_createClass(EventDispatcher,[{key:'addEventListener',value:function addEventListener(aEventType,aFunction){if(this._eventListeners===null){this._eventListeners={};}if(!this._eventListeners[aEventType]){this._eventListeners[aEventType]=[];}this._eventListeners[aEventType].push(aFunction);return this;}},{key:'removeEventListener',value:function removeEventListener(aEventType,aFunction){if(this._eventListeners===null){this._eventListeners={};}var currentArray=this._eventListeners[aEventType];if(typeof currentArray==='undefined'){return this;}var currentArrayLength=currentArray.length;for(var i=0;i<currentArrayLength;i++){if(currentArray[i]===aFunction){currentArray.splice(i,1);i--;currentArrayLength--;}}return this;}},{key:'dispatchEvent',value:function dispatchEvent(aEvent){if(this._eventListeners===null){this._eventListeners={};}var eventType=aEvent.type;try{if(aEvent.target===null){aEvent.target=this;}aEvent.currentTarget=this;}catch(theError){var newEvent={'type':eventType,'detail':aEvent.detail,'dispatcher':this};return this.dispatchEvent(newEvent);}var currentEventListeners=this._eventListeners[eventType];if(currentEventListeners!==null&&currentEventListeners!==undefined){var currentArray=this._copyArray(currentEventListeners);var currentArrayLength=currentArray.length;for(var i=0;i<currentArrayLength;i++){var currentFunction=currentArray[i];currentFunction.call(this,aEvent);}}return this;}},{key:'dispatchCustomEvent',value:function dispatchCustomEvent(aEventType,aDetail){var newEvent=undefined;if(supportsCustomEvents){newEvent=document.createEvent('CustomEvent');newEvent.dispatcher=this;newEvent.initCustomEvent(aEventType,false,false,aDetail);}else {newEvent={'type':aEventType,'detail':aDetail,'dispatcher':this};}return this.dispatchEvent(newEvent);}},{key:'_destroy',value:function _destroy(){if(this._eventListeners!==null){for(var objectName in this._eventListeners){if(this._eventListeners.hasOwnProperty(objectName)){var currentArray=this._eventListeners[objectName];var currentArrayLength=currentArray.length;for(var i=0;i<currentArrayLength;i++){currentArray[i]=null;}delete this._eventListeners[objectName];}}this._eventListeners=null;}}},{key:'_copyArray',value:function _copyArray(aArray){var currentArray=new Array(aArray.length);var currentArrayLength=currentArray.length;for(var i=0;i<currentArrayLength;i++){currentArray[i]=aArray[i];}return currentArray;}}]);return EventDispatcher;}();exports.default=EventDispatcher;},{}],35:[function(_dereq_,module,exports){ // HDRParser.js
'use strict'; //Code ported by Marcin Ignac (2014)
//Based on Java implementation from
//https://code.google.com/r/cys12345-research/source/browse/hdr/image_processor/RGBE.java?r=7d84e9fd866b24079dbe61fa0a966ce8365f5726
Object.defineProperty(exports,"__esModule",{value:true});var radiancePattern='#\\?RADIANCE';var commentPattern='#.*'; // let gammaPattern = 'GAMMA=';
var exposurePattern='EXPOSURE=\\s*([0-9]*[.][0-9]*)';var formatPattern='FORMAT=32-bit_rle_rgbe';var widthHeightPattern='-Y ([0-9]+) \\+X ([0-9]+)'; //http://croquetweak.blogspot.co.uk/2014/08/deconstructing-floats-frexp-and-ldexp.html
// function ldexp(mantissa, exponent) {
//     return exponent > 1023 ? mantissa * Math.pow(2, 1023) * Math.pow(2, exponent - 1023) : exponent < -1074 ? mantissa * Math.pow(2, -1074) * Math.pow(2, exponent + 1074) : mantissa * Math.pow(2, exponent);
// }
function readPixelsRawRLE(buffer,data,offset,fileOffset,scanline_width,num_scanlines){var rgbe=new Array(4);var scanline_buffer=null;var ptr=undefined;var ptr_end=undefined;var count=undefined;var buf=new Array(2);var bufferLength=buffer.length;function readBuf(buf){var bytesRead=0;do {buf[bytesRead++]=buffer[fileOffset];}while(++fileOffset<bufferLength&&bytesRead<buf.length);return bytesRead;}function readBufOffset(buf,offset,length){var bytesRead=0;do {buf[offset+bytesRead++]=buffer[fileOffset];}while(++fileOffset<bufferLength&&bytesRead<length);return bytesRead;}function readPixelsRaw(buffer,data,offset,numpixels){var numExpected=4*numpixels;var numRead=readBufOffset(data,offset,numExpected);if(numRead<numExpected){throw new Error('Error reading raw pixels: got '+numRead+' bytes, expected '+numExpected);}}while(num_scanlines>0){if(readBuf(rgbe)<rgbe.length){throw new Error('Error reading bytes: expected '+rgbe.length);}if(rgbe[0]!==2||rgbe[1]!==2||(rgbe[2]&0x80)!==0){ //this file is not run length encoded
data[offset++]=rgbe[0];data[offset++]=rgbe[1];data[offset++]=rgbe[2];data[offset++]=rgbe[3];readPixelsRaw(buffer,data,offset,scanline_width*num_scanlines-1);return;}if(((rgbe[2]&0xFF)<<8|rgbe[3]&0xFF)!==scanline_width){throw new Error('Wrong scanline width '+((rgbe[2]&0xFF)<<8|rgbe[3]&0xFF)+', expected '+scanline_width);}if(scanline_buffer===null){scanline_buffer=new Array(4*scanline_width);}ptr=0; /* read each of the four channels for the scanline into the buffer */for(var i=0;i<4;i++){ptr_end=(i+1)*scanline_width;while(ptr<ptr_end){if(readBuf(buf)<buf.length){throw new Error('Error reading 2-byte buffer');}if((buf[0]&0xFF)>128){ /* a run of the same value */count=(buf[0]&0xFF)-128;if(count===0||count>ptr_end-ptr){throw new Error('Bad scanline data');}while(count-->0){scanline_buffer[ptr++]=buf[1];}}else { /* a non-run */count=buf[0]&0xFF;if(count===0||count>ptr_end-ptr){throw new Error('Bad scanline data');}scanline_buffer[ptr++]=buf[1];if(--count>0){if(readBufOffset(scanline_buffer,ptr,count)<count){throw new Error('Error reading non-run data');}ptr+=count;}}}} /* copy byte data to output */for(var i=0;i<scanline_width;i++){data[offset+0]=scanline_buffer[i];data[offset+1]=scanline_buffer[i+scanline_width];data[offset+2]=scanline_buffer[i+2*scanline_width];data[offset+3]=scanline_buffer[i+3*scanline_width];offset+=4;}num_scanlines--;}} //Returns data as floats and flipped along Y by default
function parseHdr(buffer){if(buffer instanceof ArrayBuffer){buffer=new Uint8Array(buffer);}var fileOffset=0;var bufferLength=buffer.length;var NEW_LINE=10;function readLine(){var buf='';do {var b=buffer[fileOffset];if(b===NEW_LINE){++fileOffset;break;}buf+=String.fromCharCode(b);}while(++fileOffset<bufferLength);return buf;}var width=0;var height=0;var exposure=1;var gamma=1;var rle=false;for(var i=0;i<20;i++){var line=readLine();var match=undefined;if(match=line.match(radiancePattern)){}else if(match=line.match(formatPattern)){rle=true;}else if(match=line.match(exposurePattern)){exposure=Number(match[1]);}else if(match=line.match(commentPattern)){}else if(match=line.match(widthHeightPattern)){height=Number(match[1]);width=Number(match[2]);break;}}if(!rle){throw new Error('File is not run length encoded!');}var data=new Uint8Array(width*height*4);var scanline_width=width;var num_scanlines=height;readPixelsRawRLE(buffer,data,0,fileOffset,scanline_width,num_scanlines); //TODO: Should be Float16
var floatData=new Float32Array(width*height*4);for(var offset=0;offset<data.length;offset+=4){var r=data[offset+0]/255;var g=data[offset+1]/255;var b=data[offset+2]/255;var e=data[offset+3];var f=Math.pow(2.0,e-128.0);r*=f;g*=f;b*=f;var floatOffset=offset;floatData[floatOffset+0]=r;floatData[floatOffset+1]=g;floatData[floatOffset+2]=b;floatData[floatOffset+3]=1.0;}return {shape:[width,height],exposure:exposure,gamma:gamma,data:floatData};}exports.default=parseHdr;},{}],36:[function(_dereq_,module,exports){ // OrbitalControl.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _EaseNumber=_dereq_('./EaseNumber');var _EaseNumber2=_interopRequireDefault(_EaseNumber);var _Scheduler=_dereq_('./Scheduler');var _Scheduler2=_interopRequireDefault(_Scheduler);var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var getMouse=function getMouse(mEvent,mTarget){var o=mTarget||{};if(mEvent.touches){o.x=mEvent.touches[0].pageX;o.y=mEvent.touches[0].pageY;}else {o.x=mEvent.clientX;o.y=mEvent.clientY;}return o;};var OrbitalControl=function(){function OrbitalControl(mTarget){var _this=this;var mListenerTarget=arguments.length<=1||arguments[1]===undefined?window:arguments[1];var mRadius=arguments.length<=2||arguments[2]===undefined?500:arguments[2];_classCallCheck(this,OrbitalControl);this._target=mTarget;this._listenerTarget=mListenerTarget;this._mouse={};this._preMouse={};this.center=_glMatrix2.default.vec3.create();this._up=_glMatrix2.default.vec3.fromValues(0,1,0);this.radius=new _EaseNumber2.default(mRadius);this.position=_glMatrix2.default.vec3.fromValues(0,0,this.radius.value);this.positionOffset=_glMatrix2.default.vec3.create();this._rx=new _EaseNumber2.default(0);this._rx.limit(-Math.PI/2,Math.PI/2);this._ry=new _EaseNumber2.default(0);this._preRX=0;this._preRY=0;this._isLockZoom=false;this._isLockRotation=false;this._isInvert=false;this._listenerTarget.addEventListener('mousewheel',function(e){return _this._onWheel(e);});this._listenerTarget.addEventListener('DOMMouseScroll',function(e){return _this._onWheel(e);});this._listenerTarget.addEventListener('mousedown',function(e){return _this._onDown(e);});this._listenerTarget.addEventListener('touchstart',function(e){return _this._onDown(e);});this._listenerTarget.addEventListener('mousemove',function(e){return _this._onMove(e);});this._listenerTarget.addEventListener('touchmove',function(e){return _this._onMove(e);});window.addEventListener('touchend',function(){return _this._onUp();});window.addEventListener('mouseup',function(){return _this._onUp();});_Scheduler2.default.addEF(function(){return _this._loop();});} //	PUBLIC METHODS
_createClass(OrbitalControl,[{key:'lock',value:function lock(){var mValue=arguments.length<=0||arguments[0]===undefined?true:arguments[0];this._isLockZoom=mValue;this._isLockRotation=mValue;}},{key:'lockZoom',value:function lockZoom(){var mValue=arguments.length<=0||arguments[0]===undefined?true:arguments[0];this._isLockZoom=mValue;}},{key:'lockRotation',value:function lockRotation(){var mValue=arguments.length<=0||arguments[0]===undefined?true:arguments[0];this._isLockRotation=mValue;}},{key:'inverseControl',value:function inverseControl(){var isInvert=arguments.length<=0||arguments[0]===undefined?true:arguments[0];this._isInvert=isInvert;} //	EVENT HANDLERES
},{key:'_onDown',value:function _onDown(mEvent){if(this._isLockRotation){return;}this._isMouseDown=true;getMouse(mEvent,this._mouse);getMouse(mEvent,this._preMouse);this._preRX=this._rx.targetValue;this._preRY=this._ry.targetValue;}},{key:'_onMove',value:function _onMove(mEvent){if(this._isLockRotation){return;}getMouse(mEvent,this._mouse);if(mEvent.touches){mEvent.preventDefault();}if(this._isMouseDown){var diffX=-(this._mouse.x-this._preMouse.x);if(this._isInvert){diffX*=-1;}this._ry.value=this._preRY-diffX*0.01;var diffY=-(this._mouse.y-this._preMouse.y);if(this._isInvert){diffY*=-1;}this._rx.value=this._preRX-diffY*0.01;}}},{key:'_onUp',value:function _onUp(){if(this._isLockRotation){return;}this._isMouseDown=false;}},{key:'_onWheel',value:function _onWheel(mEvent){if(this._isLockZoom){return;}var w=mEvent.wheelDelta;var d=mEvent.detail;var value=0;if(d){if(w){value=w/d/40*d>0?1:-1; // Opera
}else {value=-d/3; // Firefox;         TODO: do not /3 for OS X
}}else {value=w/120;}this.radius.add(-value*2);} //	PRIVATE METHODS
},{key:'_loop',value:function _loop(){this._updatePosition();if(this._target){this._updateCamera();}}},{key:'_updatePosition',value:function _updatePosition(){this.position[1]=Math.sin(this._rx.value)*this.radius.value;var tr=Math.cos(this._rx.value)*this.radius.value;this.position[0]=Math.cos(this._ry.value+Math.PI*0.5)*tr;this.position[2]=Math.sin(this._ry.value+Math.PI*0.5)*tr;_glMatrix2.default.vec3.add(this.position,this.position,this.positionOffset);}},{key:'_updateCamera',value:function _updateCamera(){this._target.lookAt(this.position,this.center,this._up);}}]);return OrbitalControl;}();exports.default=OrbitalControl;},{"./EaseNumber":33,"./Scheduler":38,"gl-matrix":1}],37:[function(_dereq_,module,exports){ // QuatRotation.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});var _glMatrix=_dereq_('gl-matrix');var _glMatrix2=_interopRequireDefault(_glMatrix);var _EaseNumber=_dereq_('./EaseNumber');var _EaseNumber2=_interopRequireDefault(_EaseNumber);var _Scheduler=_dereq_('./Scheduler');var _Scheduler2=_interopRequireDefault(_Scheduler);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}var getMouse=function getMouse(mEvent,mTarget){var o=mTarget||{};if(mEvent.touches){o.x=mEvent.touches[0].pageX;o.y=mEvent.touches[0].pageY;}else {o.x=mEvent.clientX;o.y=mEvent.clientY;}return o;};var QuatRotation=function(){function QuatRotation(mTarget){var _this=this;var mListenerTarget=arguments.length<=1||arguments[1]===undefined?window:arguments[1];var mEasing=arguments.length<=2||arguments[2]===undefined?0.1:arguments[2];_classCallCheck(this,QuatRotation);this._target=mTarget;this._listenerTarget=mListenerTarget;this.matrix=_glMatrix2.default.mat4.create();this.m=_glMatrix2.default.mat4.create();this._vZaxis=_glMatrix2.default.vec3.clone([0,0,0]);this._zAxis=_glMatrix2.default.vec3.clone([0,0,1]);this.preMouse={x:0,y:0};this.mouse={x:0,y:0};this._isMouseDown=false;this._rotation=_glMatrix2.default.quat.create();this.tempRotation=_glMatrix2.default.quat.create();this._rotateZMargin=0;this._offset=0.004;this._slerp=-1;this._isLocked=false;this._diffX=new _EaseNumber2.default(0,mEasing);this._diffY=new _EaseNumber2.default(0,mEasing);this._listenerTarget.addEventListener('mousedown',function(e){return _this._onDown(e);});this._listenerTarget.addEventListener('touchstart',function(e){return _this._onDown(e);});this._listenerTarget.addEventListener('mousemove',function(e){return _this._onMove(e);});this._listenerTarget.addEventListener('touchmove',function(e){return _this._onMove(e);});window.addEventListener('touchend',function(){return _this._onUp();});window.addEventListener('mouseup',function(){return _this._onUp();});_Scheduler2.default.addEF(function(){return _this._loop();});} // 	PUBLIC METHODS
_createClass(QuatRotation,[{key:'inverseControl',value:function inverseControl(){var isInvert=arguments.length<=0||arguments[0]===undefined?true:arguments[0];this._isInvert=isInvert;}},{key:'lock',value:function lock(){var mValue=arguments.length<=0||arguments[0]===undefined?true:arguments[0];this._isLocked=mValue;}},{key:'setCameraPos',value:function setCameraPos(mQuat){var speed=arguments.length<=1||arguments[1]===undefined?0.1:arguments[1];this.easing=speed;if(this._slerp>0){return;}var tempRotation=_glMatrix2.default.quat.clone(this._rotation);this._updateRotation(tempRotation);this._rotation=_glMatrix2.default.quat.clone(tempRotation);this._currDiffX=this.diffX=0;this._currDiffY=this.diffY=0;this._isMouseDown=false;this._isRotateZ=0;this._targetQuat=_glMatrix2.default.quat.clone(mQuat);this._slerp=1;}},{key:'resetQuat',value:function resetQuat(){this._rotation=_glMatrix2.default.quat.clone([0,0,1,0]);this.tempRotation=_glMatrix2.default.quat.clone([0,0,0,0]);this._targetQuat=undefined;this._slerp=-1;} //	EVENT HANDLER
},{key:'_onDown',value:function _onDown(mEvent){if(this._isLocked){return;}var mouse=getMouse(mEvent);var tempRotation=_glMatrix2.default.quat.clone(this._rotation);this._updateRotation(tempRotation);this._rotation=tempRotation;this._isMouseDown=true;this._isRotateZ=0;this.preMouse={x:mouse.x,y:mouse.y};if(mouse.y<this._rotateZMargin||mouse.y>window.innerHeight-this._rotateZMargin){this._isRotateZ=1;}else if(mouse.x<this._rotateZMargin||mouse.x>window.innerWidth-this._rotateZMargin){this._isRotateZ=2;}this._diffX.setTo(0);this._diffY.setTo(0);}},{key:'_onMove',value:function _onMove(mEvent){if(this._isLocked){return;}getMouse(mEvent,this.mouse);}},{key:'_onUp',value:function _onUp(){if(this._isLocked){return;}this._isMouseDown=false;} //	PRIVATE METHODS
},{key:'_updateRotation',value:function _updateRotation(mTempRotation){if(this._isMouseDown&&!this._isLocked){this._diffX.value=-(this.mouse.x-this.preMouse.x);this._diffY.value=this.mouse.y-this.preMouse.y;if(this._isInvert){this._diffX.value=-this._diffX.targetValue;this._diffY.value=-this._diffY.targetValue;}}var angle=undefined,_quat=undefined;if(this._isRotateZ>0){if(this._isRotateZ===1){angle=-this._diffX.value*this._offset;angle*=this.preMouse.y<this._rotateZMargin?-1:1;_quat=_glMatrix2.default.quat.clone([0,0,Math.sin(angle),Math.cos(angle)]);_glMatrix2.default.quat.multiply(_quat,mTempRotation,_quat);}else {angle=-this._diffY.value*this._offset;angle*=this.preMouse.x<this._rotateZMargin?1:-1;_quat=_glMatrix2.default.quat.clone([0,0,Math.sin(angle),Math.cos(angle)]);_glMatrix2.default.quat.multiply(_quat,mTempRotation,_quat);}}else {var v=_glMatrix2.default.vec3.clone([this._diffX.value,this._diffY.value,0]);var axis=_glMatrix2.default.vec3.create();_glMatrix2.default.vec3.cross(axis,v,this._zAxis);_glMatrix2.default.vec3.normalize(axis,axis);angle=_glMatrix2.default.vec3.length(v)*this._offset;_quat=_glMatrix2.default.quat.clone([Math.sin(angle)*axis[0],Math.sin(angle)*axis[1],Math.sin(angle)*axis[2],Math.cos(angle)]);_glMatrix2.default.quat.multiply(mTempRotation,_quat,mTempRotation);}}},{key:'_loop',value:function _loop(){_glMatrix2.default.mat4.identity(this.m);if(this._targetQuat===undefined){_glMatrix2.default.quat.set(this.tempRotation,this._rotation[0],this._rotation[1],this._rotation[2],this._rotation[3]);this._updateRotation(this.tempRotation);}else {this._slerp+=(0-this._slerp)*0.1;if(this._slerp<0.001){_glMatrix2.default.quat.set(this._rotation,this._targetQuat[0],this._targetQuat[1],this._targetQuat[2],this._targetQuat[3]);this._targetQuat=undefined;this._slerp=-1;}else {_glMatrix2.default.quat.set(this.tempRotation,0,0,0,0);_glMatrix2.default.quat.slerp(this.tempRotation,this._targetQuat,this._rotation,this._slerp);}}_glMatrix2.default.vec3.transformQuat(this._vZaxis,this._vZaxis,this.tempRotation);_glMatrix2.default.mat4.fromQuat(this.matrix,this.tempRotation);} //	GETTER AND SETTER
},{key:'easing',set:function set(mValue){this._diffX.easing=mValue;this._diffY.easing=mValue;},get:function get(){return this._diffX.easing;}}]);return QuatRotation;}();exports.default=QuatRotation;},{"./EaseNumber":33,"./Scheduler":38,"gl-matrix":1}],38:[function(_dereq_,module,exports){ // Scheduler.js
'use strict';var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value" in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor;};}();Object.defineProperty(exports,"__esModule",{value:true});function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}if(window.requestAnimFrame===undefined){window.requestAnimFrame=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(callback){window.setTimeout(callback,1000/60);};}();}var FRAMERATE=60;var Scheduler=function(){function Scheduler(){_classCallCheck(this,Scheduler);this._delayTasks=[];this._nextTasks=[];this._deferTasks=[];this._highTasks=[];this._usurpTask=[];this._enterframeTasks=[];this._idTable=0;this._loop();} //	PUBLIC METHODS
_createClass(Scheduler,[{key:'addEF',value:function addEF(func,params){params=params||[];var id=this._idTable;this._enterframeTasks[id]={func:func,params:params};this._idTable++;return id;}},{key:'removeEF',value:function removeEF(id){if(this._enterframeTasks[id]!==undefined){this._enterframeTasks[id]=null;}return -1;}},{key:'delay',value:function delay(func,params,_delay){var time=new Date().getTime();var t={func:func,params:params,delay:_delay,time:time};this._delayTasks.push(t);}},{key:'defer',value:function defer(func,params){var t={func:func,params:params};this._deferTasks.push(t);}},{key:'next',value:function next(func,params){var t={func:func,params:params};this._nextTasks.push(t);}},{key:'usurp',value:function usurp(func,params){var t={func:func,params:params};this._usurpTask.push(t);} //	PRIVATE METHODS
},{key:'_process',value:function _process(){var i=0,task=undefined,interval=undefined,current=undefined;for(i=0;i<this._enterframeTasks.length;i++){task=this._enterframeTasks[i];if(task!==null&&task!==undefined){ // task.func.apply(task.scope, task.params);
// console.log(task.func());
task.func(task.params);}}while(this._highTasks.length>0){task=this._highTasks.pop();task.func(task.params); // task.func.apply(task.scope, task.params);
}var startTime=new Date().getTime();for(i=0;i<this._delayTasks.length;i++){task=this._delayTasks[i];if(startTime-task.time>task.delay){ // task.func.apply(task.scope, task.params);
task.func(task.params);this._delayTasks.splice(i,1);}}startTime=new Date().getTime();interval=1000/FRAMERATE;while(this._deferTasks.length>0){task=this._deferTasks.shift();current=new Date().getTime();if(current-startTime<interval){ // task.func.apply(task.scope, task.params);
task.func(task.params);}else {this._deferTasks.unshift(task);break;}}startTime=new Date().getTime();interval=1000/FRAMERATE;while(this._usurpTask.length>0){task=this._usurpTask.shift();current=new Date().getTime();if(current-startTime<interval){ // task.func.apply(task.scope, task.params);
task.func(task.params);}else { // this._usurpTask.unshift(task);
break;}}this._highTasks=this._highTasks.concat(this._nextTasks);this._nextTasks=[];this._usurpTask=[];}},{key:'_loop',value:function _loop(){var _this=this;this._process();window.requestAnimFrame(function(){return _this._loop();});}}]);return Scheduler;}();var scheduler=new Scheduler();exports.default=scheduler;},{}],39:[function(_dereq_,module,exports){ // ShaderLbs.js
'use strict';Object.defineProperty(exports,"__esModule",{value:true});var ShaderLibs={simpleColorFrag:"#define GLSLIFY 1\n// simpleColor.frag\n\n#define SHADER_NAME SIMPLE_COLOR\n\nprecision highp float;\n\nuniform vec3 color;\nuniform float opacity;\n\nvoid main(void) {\n    gl_FragColor = vec4(color, opacity);\n}",bigTriangleVert:"#define GLSLIFY 1\n// bigTriangle.vert\n\n#define SHADER_NAME BIG_TRIANGLE_VERTEX\n\nprecision highp float;\nattribute vec2 aPosition;\nvarying vec2 vTextureCoord;\n\nvoid main(void) {\n    gl_Position = vec4(aPosition, 0.0, 1.0);\n    vTextureCoord = aPosition * .5 + .5;\n}",generalVert:"#define GLSLIFY 1\n// general.vert\n\n#define SHADER_NAME GENERAL_VERTEX\n\nprecision highp float;\nattribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\n\nuniform vec3 position;\nuniform vec3 scale;\n\nvarying vec2 vTextureCoord;\n\nvoid main(void) {\n\tvec3 pos      = aVertexPosition * scale;\n\tpos           += position;\n\tgl_Position   = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);\n\tvTextureCoord = aTextureCoord;\n}",generalNormalVert:"#define GLSLIFY 1\n// generalWithNormal.vert\n\n#define SHADER_NAME GENERAL_VERTEX\n\nprecision highp float;\nattribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec3 aNormal;\n\nuniform mat4 uModelMatrix;\nuniform mat4 uViewMatrix;\nuniform mat4 uProjectionMatrix;\nuniform mat3 uNormalMatrix;\n\nuniform vec3 position;\nuniform vec3 scale;\n\nvarying vec2 vTextureCoord;\nvarying vec3 vNormal;\n\nvoid main(void) {\n\tvec3 pos      = aVertexPosition * scale;\n\tpos           += position;\n\tgl_Position   = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);\n\t\n\tvTextureCoord = aTextureCoord;\n\tvNormal       = normalize(uNormalMatrix * aNormal);\n}"};exports.default=ShaderLibs;},{}]},{},[11])(11);}); 

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],21:[function(require,module,exports){
'use strict';

var Analyser = require('./effect/analyser.js'),
    Distortion = require('./effect/distortion.js'),
    Echo = require('./effect/echo.js'),
    FakeContext = require('./effect/fake-context.js'),
    Filter = require('./effect/filter.js'),
    Flanger = require('./effect/flanger.js'),
    Panner = require('./effect/panner.js'),
    Phaser = require('./effect/phaser.js'),
    Recorder = require('./effect/recorder.js'),
    Reverb = require('./effect/reverb.js');

function Effect(context) {
    context = context || new FakeContext();

    var api,
        destination,
        nodeList = [],
        panning = new Panner(context),
        sourceNode;

    var has = function has(node) {
        if (!node) {
            return false;
        }
        return nodeList.indexOf(node) > -1;
    };

    var add = function add(node) {
        if (!node) {
            return;
        }
        if (has(node)) {
            return node;
        }
        nodeList.push(node);
        updateConnections();
        return node;
    };

    var remove = function remove(node) {
        if (!node) {
            return;
        }
        if (!has(node)) {
            return node;
        }
        var l = nodeList.length;
        for (var i = 0; i < l; i++) {
            if (node === nodeList[i]) {
                nodeList.splice(i, 1);
                break;
            }
        }
        var output = node._output || node;
        output.disconnect();
        updateConnections();
        return node;
    };

    var toggle = function toggle(node, force) {
        force = !!force;
        var hasNode = has(node);
        if (arguments.length > 1 && hasNode === force) {
            return api;
        }
        if (hasNode) {
            remove(node);
        } else {
            add(node);
        }
        return api;
    };

    var removeAll = function removeAll() {
        while (nodeList.length) {
            nodeList.pop().disconnect();
        }
        updateConnections();
        return api;
    };

    var destroy = function destroy() {
        removeAll();
        context = null;
        destination = null;
        nodeList = [];
        if (sourceNode) {
            sourceNode.disconnect();
        }
        sourceNode = null;
    };

    var connect = function connect(a, b) {
        //console.log('> connect', (a.name || a.constructor.name), 'to', (b.name || b.constructor.name));

        var output = a._output || a;
        //console.log('> disconnect output: ', (a.name || a.constructor.name));
        output.disconnect();
        //console.log('> connect output: ', (a.name || a.constructor.name), 'to input:', (b.name || b.constructor.name));
        output.connect(b);
    };

    var connectToDestination = function connectToDestination(node) {
        var l = nodeList.length,
            lastNode = l ? nodeList[l - 1] : sourceNode;

        if (lastNode) {
            connect(lastNode, node);
        }

        destination = node;
    };

    var updateConnections = function updateConnections() {
        if (!sourceNode) {
            return;
        }

        //console.log('updateConnections:', nodeList.length);

        var node, prev;

        for (var i = 0; i < nodeList.length; i++) {
            node = nodeList[i];
            //console.log(i, node);
            prev = i === 0 ? sourceNode : nodeList[i - 1];
            connect(prev, node);
        }

        if (destination) {
            connectToDestination(destination);
        }
    };

    /*
     * Effects
     */

    var analyser = function analyser(config) {
        return add(new Analyser(context, config));
    };

    // lowers the volume of the loudest parts of the signal and raises the volume of the softest parts
    var compressor = function compressor(config) {
        config = config || {};

        var node = context.createDynamicsCompressor();

        node.update = function (config) {
            // min decibels to start compressing at from -100 to 0
            node.threshold.value = config.threshold !== undefined ? config.threshold : -24;
            // decibel value to start curve to compressed value from 0 to 40
            node.knee.value = config.knee !== undefined ? config.knee : 30;
            // amount of change per decibel from 1 to 20
            node.ratio.value = config.ratio !== undefined ? config.ratio : 12;
            // gain reduction currently applied by compressor from -20 to 0
            node.reduction.value = config.reduction !== undefined ? config.reduction : -10;
            // seconds to reduce gain by 10db from 0 to 1 - how quickly signal adapted when volume increased
            node.attack.value = config.attack !== undefined ? config.attack : 0.0003;
            // seconds to increase gain by 10db from 0 to 1 - how quickly signal adapted when volume redcuced
            node.release.value = config.release !== undefined ? config.release : 0.25;
        };

        node.update(config);

        return add(node);
    };

    var convolver = function convolver(impulseResponse) {
        // impulseResponse is an audio file buffer
        var node = context.createConvolver();
        node.buffer = impulseResponse;
        return add(node);
    };

    var delay = function delay(time) {
        var node = context.createDelay();
        if (time !== undefined) {
            node.delayTime.value = time;
        }
        return add(node);
    };

    var echo = function echo(config) {
        return add(new Echo(context, config));
    };

    var distortion = function distortion(amount) {
        // Float32Array defining curve (values are interpolated)
        //node.curve
        // up-sample before applying curve for better resolution result 'none', '2x' or '4x'
        //node.oversample = '2x';
        return add(new Distortion(context, amount));
    };

    var filter = function filter(type, frequency, q, gain) {
        return add(new Filter(context, type, frequency, q, gain));
    };

    var lowpass = function lowpass(frequency, peak) {
        return filter('lowpass', frequency, peak);
    };

    var highpass = function highpass(frequency, peak) {
        return filter('highpass', frequency, peak);
    };

    var bandpass = function bandpass(frequency, width) {
        return filter('bandpass', frequency, width);
    };

    var lowshelf = function lowshelf(frequency, gain) {
        return filter('lowshelf', frequency, 0, gain);
    };

    var highshelf = function highshelf(frequency, gain) {
        return filter('highshelf', frequency, 0, gain);
    };

    var peaking = function peaking(frequency, width, gain) {
        return filter('peaking', frequency, width, gain);
    };

    var notch = function notch(frequency, width, gain) {
        return filter('notch', frequency, width, gain);
    };

    var allpass = function allpass(frequency, sharpness) {
        return filter('allpass', frequency, sharpness);
    };

    var flanger = function flanger(config) {
        return add(new Flanger(context, config));
    };

    var gain = function gain(value) {
        var node = context.createGain();
        if (value !== undefined) {
            node.gain.value = value;
        }
        return node;
    };

    var panner = function panner() {
        return add(new Panner(context));
    };

    var phaser = function phaser(config) {
        return add(new Phaser(context, config));
    };

    var recorder = function recorder(passThrough) {
        return add(new Recorder(context, passThrough));
    };

    var reverb = function reverb(seconds, decay, reverse) {
        return add(new Reverb(context, seconds, decay, reverse));
    };

    var script = function script(config) {
        config = config || {};
        // bufferSize 256 - 16384 (pow 2)
        var bufferSize = config.bufferSize || 1024;
        var inputChannels = config.inputChannels === undefined ? 0 : inputChannels;
        var outputChannels = config.outputChannels === undefined ? 1 : outputChannels;

        var node = context.createScriptProcessor(bufferSize, inputChannels, outputChannels);

        var thisArg = config.thisArg || config.context || node;
        var callback = config.callback || function () {};

        // available props:
        /*
        event.inputBuffer
        event.outputBuffer
        event.playbackTime
        */
        // Example: generate noise
        /*
        var output = event.outputBuffer.getChannelData(0);
        var l = output.length;
        for (var i = 0; i < l; i++) {
            output[i] = Math.random();
        }
        */
        node.onaudioprocess = callback.bind(thisArg);

        return add(node);
    };

    var setSource = function setSource(node) {
        sourceNode = node;
        updateConnections();
        return node;
    };

    var setDestination = function setDestination(node) {
        connectToDestination(node);
        return node;
    };

    //

    api = {
        context: context,
        nodeList: nodeList,
        panning: panning,

        has: has,
        add: add,
        remove: remove,
        toggle: toggle,
        removeAll: removeAll,
        destroy: destroy,
        setSource: setSource,
        setDestination: setDestination,

        analyser: analyser,
        compressor: compressor,
        convolver: convolver,
        delay: delay,
        echo: echo,
        distortion: distortion,
        filter: filter,
        lowpass: lowpass,
        highpass: highpass,
        bandpass: bandpass,
        lowshelf: lowshelf,
        highshelf: highshelf,
        peaking: peaking,
        notch: notch,
        allpass: allpass,
        flanger: flanger,
        gain: gain,
        panner: panner,
        phaser: phaser,
        recorder: recorder,
        reverb: reverb,
        script: script
    };

    return Object.freeze(api);
}

module.exports = Effect;

},{"./effect/analyser.js":22,"./effect/distortion.js":23,"./effect/echo.js":24,"./effect/fake-context.js":25,"./effect/filter.js":26,"./effect/flanger.js":27,"./effect/panner.js":28,"./effect/phaser.js":29,"./effect/recorder.js":30,"./effect/reverb.js":31}],22:[function(require,module,exports){
'use strict';

function Analyser(context, config) {
    config = config || {};

    var fftSize = config.fftSize || 512,
        freqFloat = !!config.float,
        waveFloat = !!config.float,
        waveform,
        frequencies,
        node = context.createAnalyser();

    node.fftSize = fftSize; // frequencyBinCount will be half this value
    node.smoothingTimeConstant = config.smoothing || config.smoothingTimeConstant || node.smoothingTimeConstant;
    node.minDecibels = config.minDecibels || node.minDecibels;
    node.maxDecibels = config.maxDecibels || node.maxDecibels;

    var needsUpdate = function needsUpdate(arr, float) {
        if (!arr) {
            return true;
        }
        if (node.fftSize !== fftSize) {
            return true;
        }
        if (float && arr instanceof Uint8Array) {
            return true;
        }
        return !float && arr instanceof Float32Array;
    };

    var createArray = function createArray(float, length) {
        return float ? new Float32Array(length) : new Uint8Array(length);
    };

    node.getWaveform = function (float) {
        if (!arguments.length) {
            float = waveFloat;
        }

        if (needsUpdate(waveform, float)) {
            fftSize = node.fftSize;
            waveFloat = float;
            waveform = createArray(float, fftSize);
        }

        if (float) {
            this.getFloatTimeDomainData(waveform);
        } else {
            this.getByteTimeDomainData(waveform);
        }

        return waveform;
    };

    node.getFrequencies = function (float) {
        if (!arguments.length) {
            float = freqFloat;
        }

        if (needsUpdate(frequencies, float)) {
            fftSize = node.fftSize;
            freqFloat = float;
            frequencies = createArray(float, node.frequencyBinCount);
        }

        if (float) {
            this.getFloatFrequencyData(frequencies);
        } else {
            this.getByteFrequencyData(frequencies);
        }

        return frequencies;
    };

    node.update = function () {
        node.getWaveform();
        node.getFrequencies();
    };

    Object.defineProperties(node, {
        smoothing: {
            get: function get() {
                return node.smoothingTimeConstant;
            },
            set: function set(value) {
                node.smoothingTimeConstant = value;
            }
        }
    });

    return node;
}

module.exports = Analyser;

},{}],23:[function(require,module,exports){
'use strict';

var validify = require('../utils/validify.js').number;
var n = 22050;

function Distortion(context, amount) {

    amount = validify(amount, 1);

    var node = context.createWaveShaper();
    var curve = new Float32Array(n);

    // create waveShaper distortion curve from 0 to 1
    node.update = function (value) {
        amount = value;
        if (amount <= 0) {
            amount = 0;
            this.curve = null;
            return;
        }
        var k = value * 100,

        // n = 22050,
        // curve = new Float32Array(n),
        deg = Math.PI / 180,
            x;

        for (var i = 0; i < n; i++) {
            x = i * 2 / n - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }

        this.curve = curve;
    };

    Object.defineProperties(node, {
        amount: {
            get: function get() {
                return amount;
            },
            set: function set(value) {
                this.update(value);
            }
        }
    });

    if (amount !== undefined) {
        node.update(amount);
    }

    return node;
}

module.exports = Distortion;

},{"../utils/validify.js":46}],24:[function(require,module,exports){
'use strict';

var validify = require('../utils/validify.js').number;

function Echo(context, config) {
    config = config || {};

    var input = context.createGain();
    var delay = context.createDelay();
    var gain = context.createGain();
    var output = context.createGain();

    delay.delayTime.value = validify(config.delayTime, 0.5);
    gain.gain.value = validify(config.feedback, 0.5);

    input.connect(delay);
    input.connect(output);
    delay.connect(gain);
    gain.connect(delay);
    gain.connect(output);

    var node = input;
    node.name = 'Echo';
    node._output = output;

    Object.defineProperties(node, {
        delay: {
            get: function get() {
                return delay.delayTime.value;
            },
            set: function set(value) {
                delay.delayTime.value = value;
            }
        },
        feedback: {
            get: function get() {
                return gain.gain.value;
            },
            set: function set(value) {
                gain.gain.value = value;
            }
        }
    });

    return node;
}

module.exports = Echo;

},{"../utils/validify.js":46}],25:[function(require,module,exports){
'use strict';

function FakeContext() {

    var startTime = Date.now();

    var fn = function fn() {};

    var param = function param() {
        return {
            value: 1,
            defaultValue: 1,
            linearRampToValueAtTime: fn,
            setValueAtTime: fn,
            exponentialRampToValueAtTime: fn,
            setTargetAtTime: fn,
            setValueCurveAtTime: fn,
            cancelScheduledValues: fn
        };
    };

    var fakeNode = function fakeNode() {
        return {
            connect: fn,
            disconnect: fn,
            // analyser
            frequencyBinCount: 0,
            smoothingTimeConstant: 0,
            fftSize: 0,
            minDecibels: 0,
            maxDecibels: 0,
            getByteTimeDomainData: fn,
            getByteFrequencyData: fn,
            getFloatTimeDomainData: fn,
            getFloatFrequencyData: fn,
            // gain
            gain: param(),
            // panner
            panningModel: 0,
            setPosition: fn,
            setOrientation: fn,
            setVelocity: fn,
            distanceModel: 0,
            refDistance: 0,
            maxDistance: 0,
            rolloffFactor: 0,
            coneInnerAngle: 360,
            coneOuterAngle: 360,
            coneOuterGain: 0,
            // filter:
            type: 0,
            frequency: param(),
            Q: param(),
            detune: param(),
            // delay
            delayTime: param(),
            // convolver
            buffer: 0,
            // compressor
            threshold: param(),
            knee: param(),
            ratio: param(),
            attack: param(),
            release: param(),
            reduction: param(),
            // distortion
            oversample: 0,
            curve: 0,
            // buffer
            sampleRate: 1,
            length: 0,
            duration: 0,
            numberOfChannels: 0,
            getChannelData: function getChannelData() {
                return [];
            },
            copyFromChannel: fn,
            copyToChannel: fn,
            // listener
            dopplerFactor: 0,
            speedOfSound: 0,
            // osc
            start: fn
        };
    };

    // ie9
    if (!window.Uint8Array) {
        window.Uint8Array = window.Float32Array = Array;
    }

    return {
        createAnalyser: fakeNode,
        createBuffer: fakeNode,
        createBiquadFilter: fakeNode,
        createChannelMerger: fakeNode,
        createChannelSplitter: fakeNode,
        createDynamicsCompressor: fakeNode,
        createConvolver: fakeNode,
        createDelay: fakeNode,
        createGain: fakeNode,
        createOscillator: fakeNode,
        createPanner: fakeNode,
        createScriptProcessor: fakeNode,
        createWaveShaper: fakeNode,
        listener: fakeNode(),
        get currentTime() {
            return (Date.now() - startTime) / 1000;
        }
    };
}

module.exports = FakeContext;

},{}],26:[function(require,module,exports){
'use strict';

// https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode
// For lowpass and highpass Q indicates how peaked the frequency is around the cutoff.
// The greater the value is, the greater is the peak

function Filter(context, type, frequency, q, gain) {
    // Frequency between 40Hz and half of the sampling rate
    var minFrequency = 40;
    var maxFrequency = context.sampleRate / 2;

    var node = context.createBiquadFilter();
    node.type = type;

    var getFrequency = function getFrequency(value) {
        // Logarithm (base 2) to compute how many octaves fall in the range.
        var numberOfOctaves = Math.log(maxFrequency / minFrequency) / Math.LN2;
        // Compute a multiplier from 0 to 1 based on an exponential scale.
        var multiplier = Math.pow(2, numberOfOctaves * (value - 1.0));
        // Get back to the frequency value between min and max.
        return maxFrequency * multiplier;
    };

    node.set = function (frequency, q, gain) {
        if (frequency !== undefined) {
            node.frequency.value = frequency;
        }
        if (q !== undefined) {
            node.Q.value = q;
        }
        if (gain !== undefined) {
            node.gain.value = gain;
        }
        return node;
    };

    // set filter frequency based on value from 0 to 1
    node.setByPercent = function (percent, q, gain) {
        return node.set(getFrequency(percent), q, gain);
    };

    return node.set(frequency, q, gain);
}

module.exports = Filter;

},{}],27:[function(require,module,exports){
'use strict';

var validify = require('../utils/validify.js').number;

function MonoFlanger(context, config) {
    var input = context.createGain();
    var delay = context.createDelay();
    var feedback = context.createGain();
    var lfo = context.createOscillator();
    var gain = context.createGain();
    var output = context.createGain();

    delay.delayTime.value = validify(config.delay, 0.005); // 5-25ms delay (0.005 > 0.025)
    feedback.gain.value = validify(config.feedback, 0.5); // 0 > 1

    lfo.type = 'sine';
    lfo.frequency.value = validify(config.gain, 0.002); // 0.05 > 5
    gain.gain.value = validify(config.frequency, 0.25); // 0.0005 > 0.005

    input.connect(output);
    input.connect(delay);
    delay.connect(output);
    delay.connect(feedback);
    feedback.connect(input);

    lfo.connect(gain);
    gain.connect(delay.delayTime);
    lfo.start(0);

    var node = input;
    node.name = 'Flanger';
    node._output = output;

    Object.defineProperties(node, {
        delay: {
            get: function get() {
                return delay.delayTime.value;
            },
            set: function set(value) {
                delay.delayTime.value = value;
            }
        },
        lfoFrequency: {
            get: function get() {
                return lfo.frequency.value;
            },
            set: function set(value) {
                lfo.frequency.value = value;
            }
        },
        lfoGain: {
            get: function get() {
                return gain.gain.value;
            },
            set: function set(value) {
                gain.gain.value = value;
            }
        },
        feedback: {
            get: function get() {
                return feedback.gain.value;
            },
            set: function set(value) {
                feedback.gain.value = value;
            }
        }
    });

    return node;
}

function StereoFlanger(context, config) {
    var input = context.createGain();
    var splitter = context.createChannelSplitter(2);
    var merger = context.createChannelMerger(2);
    var feedbackL = context.createGain();
    var feedbackR = context.createGain();
    var lfo = context.createOscillator();
    var lfoGainL = context.createGain();
    var lfoGainR = context.createGain();
    var delayL = context.createDelay();
    var delayR = context.createDelay();
    var output = context.createGain();

    feedbackL.gain.value = feedbackR.gain.value = validify(config.feedback, 0.5);
    delayL.delayTime.value = delayR.delayTime.value = validify(config.delay, 0.003);

    lfo.type = 'sine';
    lfo.frequency.value = validify(config.frequency, 0.5);
    lfoGainL.gain.value = validify(config.gain, 0.005);
    lfoGainR.gain.value = 0 - lfoGainL.gain.value;

    input.connect(splitter);

    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);

    delayL.connect(feedbackL);
    delayR.connect(feedbackR);

    feedbackL.connect(delayR);
    feedbackR.connect(delayL);

    delayL.connect(merger, 0, 0);
    delayR.connect(merger, 0, 1);

    merger.connect(output);
    input.connect(output);

    lfo.connect(lfoGainL);
    lfo.connect(lfoGainR);
    lfoGainL.connect(delayL.delayTime);
    lfoGainR.connect(delayR.delayTime);
    lfo.start(0);

    var node = input;
    node.name = 'StereoFlanger';
    node._output = output;

    Object.defineProperties(node, {
        delay: {
            get: function get() {
                return delayL.delayTime.value;
            },
            set: function set(value) {
                delayL.delayTime.value = delayR.delayTime.value = value;
            }
        },
        lfoFrequency: {
            get: function get() {
                return lfo.frequency.value;
            },
            set: function set(value) {
                lfo.frequency.value = value;
            }
        },
        lfoGain: {
            get: function get() {
                return lfoGainL.gain.value;
            },
            set: function set(value) {
                lfoGainL.gain.value = lfoGainR.gain.value = value;
            }
        },
        feedback: {
            get: function get() {
                return feedbackL.gain.value;
            },
            set: function set(value) {
                feedbackL.gain.value = feedbackR.gain.value = value;
            }
        }
    });

    return node;
}

function Flanger(context, config) {
    config = config || {};
    return config.stereo ? new StereoFlanger(context, config) : new MonoFlanger(context, config);
}

module.exports = Flanger;

},{"../utils/validify.js":46}],28:[function(require,module,exports){
'use strict';

var validify = require('../utils/validify.js').number;

function Panner(context) {
    var node = context.createPanner();

    // Default for stereo is 'HRTF' can also be 'equalpower'
    node.panningModel = Panner.defaults.panningModel;

    // Distance model and attributes
    // Can be 'linear' 'inverse' 'exponential'
    node.distanceModel = Panner.defaults.distanceModel;
    node.refDistance = Panner.defaults.refDistance;
    node.maxDistance = Panner.defaults.maxDistance;
    node.rolloffFactor = Panner.defaults.rolloffFactor;
    node.coneInnerAngle = Panner.defaults.coneInnerAngle;
    node.coneOuterAngle = Panner.defaults.coneOuterAngle;
    node.coneOuterGain = Panner.defaults.coneOuterGain;
    // set to defaults (needed in Firefox)
    node.setPosition(0, 0, 1);
    node.setOrientation(0, 0, 0);

    // simple vec3 object pool
    var vecPool = {
        pool: [],
        get: function get(x, y, z) {
            var v = this.pool.length ? this.pool.pop() : { x: 0, y: 0, z: 0 };
            // check if a vector has been passed in
            if (x !== undefined && isNaN(x) && 'x' in x && 'y' in x && 'z' in x) {
                v.x = validify(x.x);
                v.y = validify(x.y);
                v.z = validify(x.z);
            } else {
                v.x = validify(x);
                v.y = validify(y);
                v.z = validify(z);
            }
            return v;
        },
        dispose: function dispose(instance) {
            this.pool.push(instance);
        }
    };

    var globalUp = vecPool.get(0, 1, 0),
        angle45 = Math.PI / 4,
        angle90 = Math.PI / 2;

    // set the orientation of the source (where the audio is coming from)
    var setOrientation = function setOrientation(node, fw) {
        // calculate up vec ( up = (forward cross (0, 1, 0)) cross forward )
        var up = vecPool.get(fw.x, fw.y, fw.z);
        cross(up, globalUp);
        cross(up, fw);
        normalize(up);
        normalize(fw);
        // set the audio context's listener position to match the camera position
        node.setOrientation(fw.x, fw.y, fw.z, up.x, up.y, up.z);
        // return the vecs to the pool
        vecPool.dispose(fw);
        vecPool.dispose(up);
    };

    var setPosition = function setPosition(nodeOrListener, vec) {
        nodeOrListener.setPosition(vec.x, vec.y, vec.z);
        vecPool.dispose(vec);
    };

    // cross product of 2 vectors
    var cross = function cross(a, b) {
        var ax = a.x,
            ay = a.y,
            az = a.z;
        var bx = b.x,
            by = b.y,
            bz = b.z;
        a.x = ay * bz - az * by;
        a.y = az * bx - ax * bz;
        a.z = ax * by - ay * bx;
    };

    // normalise to unit vector
    var normalize = function normalize(vec3) {
        if (vec3.x === 0 && vec3.y === 0 && vec3.z === 0) {
            return vec3;
        }
        var length = Math.sqrt(vec3.x * vec3.x + vec3.y * vec3.y + vec3.z * vec3.z);
        var invScalar = 1 / length;
        vec3.x *= invScalar;
        vec3.y *= invScalar;
        vec3.z *= invScalar;
        return vec3;
    };

    node.set = function (x, y, z) {
        var v = vecPool.get(x, y, z);

        if (arguments.length === 1 && v.x) {
            // pan left to right with value from -1 to 1
            x = v.x;

            if (x > 1) {
                x = 1;
            }
            if (x < -1) {
                x = -1;
            }

            // creates a nice curve with z
            x = x * angle45;
            z = x + angle90;

            if (z > angle90) {
                z = Math.PI - z;
            }

            v.x = Math.sin(x);
            v.z = Math.sin(z);
        }
        setPosition(node, v);
    };

    // set the position the audio is coming from)
    node.setSourcePosition = function (x, y, z) {
        setPosition(node, vecPool.get(x, y, z));
    };

    // set the direction the audio is coming from)
    node.setSourceOrientation = function (x, y, z) {
        setOrientation(node, vecPool.get(x, y, z));
    };

    // set the position of who or what is hearing the audio (could be camera or some character)
    node.setListenerPosition = function (x, y, z) {
        setPosition(context.listener, vecPool.get(x, y, z));
    };

    // set the position of who or what is hearing the audio (could be camera or some character)
    node.setListenerOrientation = function (x, y, z) {
        setOrientation(context.listener, vecPool.get(x, y, z));
    };

    node.getDefaults = function () {
        return Panner.defaults;
    };

    node.setDefaults = function (defaults) {
        Object.keys(defaults).forEach(function (key) {
            Panner.defaults[key] = defaults[key];
        });
    };

    return node;
}

Panner.defaults = {
    panningModel: 'HRTF',
    distanceModel: 'linear',
    refDistance: 1,
    maxDistance: 1000,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 0,
    coneOuterGain: 0
};

module.exports = Panner;

},{"../utils/validify.js":46}],29:[function(require,module,exports){
'use strict';

var validify = require('../utils/validify.js').number;

function Phaser(context, config) {
    config = config || {};
    var stages = validify(config.stages, 8),
        filters = [],
        filter;

    var input = context.createGain();
    var feedback = context.createGain();
    var lfo = context.createOscillator();
    var lfoGain = context.createGain();
    var output = context.createGain();

    feedback.gain.value = validify(config.feedback, 0.5);

    lfo.type = 'sine';
    lfo.frequency.value = validify(config.frequency, 0.5);
    lfoGain.gain.value = validify(config.gain, 300);

    for (var i = 0; i < stages; i++) {
        filter = context.createBiquadFilter();
        filter.type = 'allpass';
        filter.frequency.value = 1000 * i;
        //filter.Q.value = 10;
        if (i > 0) {
            filters[i - 1].connect(filter);
        }
        lfoGain.connect(filter.frequency);

        filters.push(filter);
    }

    var first = filters[0];
    var last = filters[filters.length - 1];

    input.connect(first);
    input.connect(output);
    last.connect(output);
    last.connect(feedback);
    feedback.connect(first);
    lfo.connect(lfoGain);
    lfo.start(0);

    var node = input;
    node.name = 'Phaser';
    node._output = output;

    Object.defineProperties(node, {
        lfoFrequency: {
            get: function get() {
                return lfo.frequency.value;
            },
            set: function set(value) {
                lfo.frequency.value = value;
            }
        },
        lfoGain: {
            get: function get() {
                return lfoGain.gain.value;
            },
            set: function set(value) {
                lfoGain.gain.value = value;
            }
        },
        feedback: {
            get: function get() {
                return feedback.gain.value;
            },
            set: function set(value) {
                feedback.gain.value = value;
            }
        }
    });

    return node;
}

module.exports = Phaser;

},{"../utils/validify.js":46}],30:[function(require,module,exports){
'use strict';

function Recorder(context, passThrough) {
    var bufferLength = 4096,
        buffersL = [],
        buffersR = [],
        startedAt = 0,
        stoppedAt = 0;

    var input = context.createGain();
    var output = context.createGain();
    var script;

    var node = input;
    node.name = 'Recorder';
    node._output = output;

    node.isRecording = false;

    var getBuffer = function getBuffer() {
        if (!buffersL.length) {
            return context.createBuffer(2, bufferLength, context.sampleRate);
        }
        var recordingLength = buffersL.length * bufferLength;
        var buffer = context.createBuffer(2, recordingLength, context.sampleRate);
        buffer.getChannelData(0).set(mergeBuffers(buffersL, recordingLength));
        buffer.getChannelData(1).set(mergeBuffers(buffersR, recordingLength));
        return buffer;
    };

    var mergeBuffers = function mergeBuffers(buffers, length) {
        var buffer = new Float32Array(length);
        var offset = 0;
        for (var i = 0; i < buffers.length; i++) {
            buffer.set(buffers[i], offset);
            offset += buffers[i].length;
        }
        return buffer;
    };

    var createScriptProcessor = function createScriptProcessor() {
        destroyScriptProcessor();

        script = context.createScriptProcessor(bufferLength, 2, 2);
        input.connect(script);
        script.connect(context.destination);
        script.connect(output);

        script.onaudioprocess = function (event) {
            var inputL = event.inputBuffer.getChannelData(0),
                inputR = event.inputBuffer.getChannelData(1);

            if (passThrough) {
                var outputL = event.outputBuffer.getChannelData(0),
                    outputR = event.outputBuffer.getChannelData(1);
                outputL.set(inputL);
                outputR.set(inputR);
            }

            if (node.isRecording) {
                buffersL.push(new Float32Array(inputL));
                buffersR.push(new Float32Array(inputR));
            }
        };
    };

    var destroyScriptProcessor = function destroyScriptProcessor() {
        if (script) {
            script.onaudioprocess = null;
            input.disconnect();
            script.disconnect();
        }
    };

    node.start = function () {
        createScriptProcessor();
        buffersL.length = 0;
        buffersR.length = 0;
        startedAt = context.currentTime;
        stoppedAt = 0;
        this.isRecording = true;
    };

    node.stop = function () {
        stoppedAt = context.currentTime;
        this.isRecording = false;
        destroyScriptProcessor();
        return getBuffer();
    };

    node.getDuration = function () {
        if (!this.isRecording) {
            return stoppedAt - startedAt;
        }
        return context.currentTime - startedAt;
    };

    return node;
}

module.exports = Recorder;

},{}],31:[function(require,module,exports){
'use strict';

var validify = require('../utils/validify.js').number;

function Reverb(context, config) {
    config = config || {};

    var time = validify(config.time, 1),
        decay = validify(config.decay, 5),
        reverse = !!config.reverse,
        rate = context.sampleRate,
        length,
        impulseResponse;

    var input = context.createGain();
    var reverb = context.createConvolver();
    var output = context.createGain();

    input.connect(reverb);
    input.connect(output);
    reverb.connect(output);

    var node = input;
    node.name = 'Reverb';
    node._output = output;

    node.update = function (opt) {
        if (opt.time !== undefined) {
            time = opt.time;
            length = Math.floor(rate * time);
            impulseResponse = length ? context.createBuffer(2, length, rate) : null;
        }
        if (opt.decay !== undefined) {
            decay = opt.decay;
        }
        if (opt.reverse !== undefined) {
            reverse = opt.reverse;
        }

        if (!impulseResponse) {
            reverb.buffer = null;
            return;
        }

        var left = impulseResponse.getChannelData(0),
            right = impulseResponse.getChannelData(1),
            n,
            e;

        for (var i = 0; i < length; i++) {
            n = reverse ? length - i : i;
            e = Math.pow(1 - n / length, decay);
            left[i] = (Math.random() * 2 - 1) * e;
            right[i] = (Math.random() * 2 - 1) * e;
        }

        reverb.buffer = impulseResponse;
    };

    node.update({
        time: time,
        decay: decay,
        reverse: reverse
    });

    Object.defineProperties(node, {
        time: {
            get: function get() {
                return time;
            },
            set: function set(value) {
                console.log.call(console, '1 set time:', value);
                if (value === time) {
                    return;
                }
                this.update({ time: value });
            }
        },
        decay: {
            get: function get() {
                return decay;
            },
            set: function set(value) {
                if (value === decay) {
                    return;
                }
                this.update({ decay: value });
            }
        },
        reverse: {
            get: function get() {
                return reverse;
            },
            set: function set(value) {
                if (value === reverse) {
                    return;
                }
                this.update({ reverse: !!value });
            }
        }
    });

    return node;
}

module.exports = Reverb;

},{"../utils/validify.js":46}],32:[function(require,module,exports){
'use strict';

var Effect = require('./effect.js');

function Group(context, destination) {
    var sounds = [],
        effect = new Effect(context),
        gain = effect.gain(),
        preMuteVolume = 1,
        group;

    if (context) {
        effect.setSource(gain);
        effect.setDestination(destination || context.destination);
    }

    /*
     * Add / remove
     */

    var add = function add(sound) {
        sound.gain.disconnect();
        sound.gain.connect(gain);

        sounds.push(sound);

        sound.once('destroy', remove);

        return group;
    };

    var find = function find(soundOrId, callback) {
        var found;

        if (!soundOrId && soundOrId !== 0) {
            return found;
        }

        sounds.some(function (sound) {
            if (sound === soundOrId || sound.id === soundOrId) {
                found = sound;
                return true;
            }
        });

        if (found && callback) {
            callback(found);
        }

        return found;
    };

    var remove = function remove(soundOrId) {
        find(soundOrId, function (sound) {
            sounds.splice(sounds.indexOf(sound), 1);
        });
        return group;
    };

    /*
     * Controls
     */

    var play = function play(delay, offset) {
        sounds.forEach(function (sound) {
            sound.play(delay, offset);
        });
        return group;
    };

    var pause = function pause() {
        sounds.forEach(function (sound) {
            if (sound.playing) {
                sound.pause();
            }
        });
        return group;
    };

    var resume = function resume() {
        sounds.forEach(function (sound) {
            if (sound.paused) {
                sound.play();
            }
        });
        return group;
    };

    var stop = function stop() {
        sounds.forEach(function (sound) {
            sound.stop();
        });
        return group;
    };

    var seek = function seek(percent) {
        sounds.forEach(function (sound) {
            sound.seek(percent);
        });
        return group;
    };

    var mute = function mute() {
        preMuteVolume = group.volume;
        group.volume = 0;
        return group;
    };

    var unMute = function unMute() {
        group.volume = preMuteVolume || 1;
        return group;
    };

    var setVolume = function setVolume(value) {
        group.volume = value;
        return group;
    };

    var fade = function fade(volume, duration) {
        if (context) {
            var param = gain.gain;
            var time = context.currentTime;

            param.cancelScheduledValues(time);
            param.setValueAtTime(param.value, time);
            // param.setValueAtTime(volume, time + duration);
            param.linearRampToValueAtTime(volume, time + duration);
            // param.setTargetAtTime(volume, time, duration);
            // param.exponentialRampToValueAtTime(Math.max(volume, 0.0001), time + duration);
        } else {
                sounds.forEach(function (sound) {
                    sound.fade(volume, duration);
                });
            }

        return group;
    };

    /*
     * Destroy
     */

    var destroy = function destroy() {
        while (sounds.length) {
            sounds.pop().destroy();
        }
    };

    /*
     * Api
     */

    group = {
        add: add,
        find: find,
        remove: remove,
        play: play,
        pause: pause,
        resume: resume,
        stop: stop,
        seek: seek,
        setVolume: setVolume,
        mute: mute,
        unMute: unMute,
        fade: fade,
        destroy: destroy
    };

    /*
     * Getters & Setters
     */

    Object.defineProperties(group, {
        effect: {
            value: effect
        },
        gain: {
            value: gain
        },
        sounds: {
            value: sounds
        },
        volume: {
            get: function get() {
                return gain.gain.value;
            },
            set: function set(value) {
                if (isNaN(value)) {
                    return;
                }

                if (context) {
                    gain.gain.cancelScheduledValues(context.currentTime);
                    gain.gain.value = value;
                    gain.gain.setValueAtTime(value, context.currentTime);
                } else {
                    gain.gain.value = value;
                }
                sounds.forEach(function (sound) {
                    if (!sound.context) {
                        sound.groupVolume = value;
                    }
                });
            }
        }
    });

    return group;
}

module.exports = Group;

},{"./effect.js":21}],33:[function(require,module,exports){
'use strict';

var BufferSource = require('./source/buffer-source.js'),
    Effect = require('./effect.js'),
    Emitter = require('./utils/emitter.js'),
    file = require('./utils/file.js'),
    Loader = require('./utils/loader.js'),
    MediaSource = require('./source/media-source.js'),
    MicrophoneSource = require('./source/microphone-source.js'),
    OscillatorSource = require('./source/oscillator-source.js'),
    ScriptSource = require('./source/script-source.js'),
    waveform = require('./utils/waveform.js')();

function Sound(context, destination) {
    var id,
        data,
        effect = new Effect(context),
        gain = effect.gain(),
        isTouchLocked = false,
        loader,
        loop = false,
        playbackRate = 1,
        playWhenReady,
        source,
        sound;

    if (context) {
        effect.setDestination(gain);
        gain.connect(destination || context.destination);
    }

    /*
     * Load
     */

    var load = function load(config) {
        var src = file.getSupportedFile(config.src || config.url || config);

        if (source && data && data.tagName) {
            source.load(src);
        } else {
            loader = loader || new Loader(src);
            loader.audioContext = !!config.asMediaElement ? null : context;
            loader.isTouchLocked = isTouchLocked;
            loader.once('loaded', function (file) {
                createSource(file);
                sound.emit('loaded', sound);
            });
        }
        return sound;
    };

    /*
     * Controls
     */

    var play = function play(delay, offset) {
        if (!source || isTouchLocked) {
            playWhenReady = function playWhenReady() {
                if (source) {
                    play(delay, offset);
                }
            };
            return sound;
        }
        playWhenReady = null;
        effect.setSource(source.sourceNode);

        // update volume needed for no webaudio
        if (!context) {
            sound.volume = gain.gain.value;
        }

        source.play(delay, offset);

        if (source.hasOwnProperty('loop')) {
            source.loop = loop;
        }

        sound.emit('play', sound);

        return sound;
    };

    var pause = function pause() {
        source && source.pause();
        sound.emit('pause', sound);
        return sound;
    };

    var stop = function stop(delay) {
        source && source.stop(delay || 0);
        sound.emit('stop', sound);
        return sound;
    };

    var seek = function seek(percent) {
        if (source) {
            source.stop();
            play(0, source.duration * percent);
        }
        return sound;
    };

    var fade = function fade(volume, duration) {
        if (!source) {
            return sound;
        }

        var param = gain.gain;

        if (context) {
            var time = context.currentTime;
            param.cancelScheduledValues(time);
            param.setValueAtTime(param.value, time);
            param.linearRampToValueAtTime(volume, time + duration);
        } else if (typeof source.fade === 'function') {
            source.fade(volume, duration);
            param.value = volume;
        }

        return sound;
    };

    /*
     * Destroy
     */

    var destroy = function destroy() {
        source && source.destroy();
        effect && effect.destroy();
        gain && gain.disconnect();
        loader && loader.destroy();
        sound.off('loaded');
        sound.off('ended');
        gain = null;
        context = null;
        data = null;
        playWhenReady = null;
        source = null;
        effect = null;
        loader = null;
        sound.emit('destroy', sound);
        sound.off('destroy');
    };

    /*
     * Create source
     */

    var createSource = function createSource(value) {
        data = value;

        if (file.isAudioBuffer(data)) {
            source = new BufferSource(data, context, function () {
                sound.emit('ended', sound);
            });
        } else if (file.isMediaElement(data)) {
            source = new MediaSource(data, context, function () {
                sound.emit('ended', sound);
            });
        } else if (file.isMediaStream(data)) {
            source = new MicrophoneSource(data, context);
        } else if (file.isOscillatorType(data && data.type || data)) {
            source = new OscillatorSource(data.type || data, context);
        } else if (file.isScriptConfig(data)) {
            source = new ScriptSource(data, context);
        } else {
            throw new Error('Cannot detect data type: ' + data);
        }

        effect.setSource(source.sourceNode);

        sound.emit('ready', sound);

        if (playWhenReady) {
            playWhenReady();
        }
    };

    sound = Object.create(Emitter.prototype, {
        _events: {
            value: {}
        },
        constructor: {
            value: Sound
        },
        play: {
            value: play
        },
        pause: {
            value: pause
        },
        load: {
            value: load
        },
        seek: {
            value: seek
        },
        stop: {
            value: stop
        },
        fade: {
            value: fade
        },
        destroy: {
            value: destroy
        },
        context: {
            value: context
        },
        currentTime: {
            get: function get() {
                return source ? source.currentTime : 0;
            },
            set: function set(value) {
                // var silent = sound.playing;
                source && source.stop();
                // play(0, value, silent);
                play(0, value);
            }
        },
        data: {
            get: function get() {
                return data;
            },
            set: function set(value) {
                if (!value) {
                    return;
                }
                createSource(value);
            }
        },
        duration: {
            get: function get() {
                return source ? source.duration : 0;
            }
        },
        effect: {
            value: effect
        },
        ended: {
            get: function get() {
                return !!source && source.ended;
            }
        },
        frequency: {
            get: function get() {
                return source ? source.frequency : 0;
            },
            set: function set(value) {
                if (source && source.hasOwnProperty('frequency')) {
                    source.frequency = value;
                }
            }
        },
        gain: {
            value: gain
        },
        id: {
            get: function get() {
                return id;
            },
            set: function set(value) {
                id = value;
            }
        },
        isTouchLocked: {
            set: function set(value) {
                isTouchLocked = value;
                if (loader) {
                    loader.isTouchLocked = value;
                }
                if (!value && playWhenReady) {
                    playWhenReady();
                }
            }
        },
        loader: {
            get: function get() {
                return loader;
            }
        },
        loop: {
            get: function get() {
                return loop;
            },
            set: function set(value) {
                loop = !!value;

                if (source && source.hasOwnProperty('loop') && source.loop !== loop) {
                    source.loop = loop;
                }
            }
        },
        paused: {
            get: function get() {
                return !!source && source.paused;
            }
        },
        playing: {
            get: function get() {
                return !!source && source.playing;
            }
        },
        playbackRate: {
            get: function get() {
                return playbackRate;
            },
            set: function set(value) {
                playbackRate = value;
                if (source) {
                    source.playbackRate = playbackRate;
                }
            }
        },
        progress: {
            get: function get() {
                return source ? source.progress : 0;
            }
        },
        volume: {
            get: function get() {
                if (context) {
                    return gain.gain.value;
                }
                if (source && source.hasOwnProperty('volume')) {
                    return source.volume;
                }
                return 1;
            },
            set: function set(value) {
                if (isNaN(value)) {
                    return;
                }

                var param = gain.gain;

                if (context) {
                    var time = context.currentTime;
                    param.cancelScheduledValues(time);
                    param.value = value;
                    param.setValueAtTime(value, time);
                } else {
                    param.value = value;

                    if (source && source.hasOwnProperty('volume')) {
                        source.volume = value;
                    }
                }
            }
        },
        // for media element source
        groupVolume: {
            get: function get() {
                return source.groupVolume;
            },
            set: function set(value) {
                if (source && source.hasOwnProperty('groupVolume')) {
                    source.groupVolume = value;
                }
            }
        },
        waveform: {
            value: function value(length) {
                if (!data) {
                    sound.once('ready', function () {
                        waveform(data, length);
                    });
                }
                return waveform(data, length);
            }
        },
        userData: {
            value: {}
        }
    });

    return Object.freeze(sound);
}

module.exports = Sound;

},{"./effect.js":21,"./source/buffer-source.js":34,"./source/media-source.js":35,"./source/microphone-source.js":36,"./source/oscillator-source.js":37,"./source/script-source.js":38,"./utils/emitter.js":40,"./utils/file.js":41,"./utils/loader.js":42,"./utils/waveform.js":47}],34:[function(require,module,exports){
'use strict';

function BufferSource(buffer, context, onEnded) {
    var ended = false,
        endedCallback = onEnded,
        loop = false,
        paused = false,
        pausedAt = 0,
        playbackRate = 1,
        playing = false,
        sourceNode = null,
        startedAt = 0,
        api = {};

    var createSourceNode = function createSourceNode() {
        if (!sourceNode && context) {
            sourceNode = context.createBufferSource();
            sourceNode.buffer = buffer;
        }
        return sourceNode;
    };

    /*
     * Controls
     */

    var play = function play(delay, offset) {
        if (playing) {
            return;
        }

        delay = delay ? context.currentTime + delay : 0;
        offset = offset || 0;
        if (offset) {
            pausedAt = 0;
        }
        if (pausedAt) {
            offset = pausedAt;
        }
        while (offset > api.duration) {
            offset = offset % api.duration;
        }

        createSourceNode();
        sourceNode.onended = endedHandler;
        sourceNode.start(delay, offset);

        sourceNode.loop = loop;
        sourceNode.playbackRate.value = playbackRate;

        startedAt = context.currentTime - offset;
        ended = false;
        paused = false;
        pausedAt = 0;
        playing = true;
    };

    var pause = function pause() {
        var elapsed = context.currentTime - startedAt;
        stop();
        pausedAt = elapsed;
        playing = false;
        paused = true;
    };

    var stop = function stop() {
        if (sourceNode) {
            sourceNode.onended = null;
            try {
                sourceNode.disconnect();
                sourceNode.stop(0);
            } catch (e) {}
            sourceNode = null;
        }

        paused = false;
        pausedAt = 0;
        playing = false;
        startedAt = 0;
    };

    /*
     * Ended handler
     */

    var endedHandler = function endedHandler() {
        stop();
        ended = true;
        if (typeof endedCallback === 'function') {
            endedCallback(api);
        }
    };

    /*
     * Destroy
     */

    var destroy = function destroy() {
        stop();
        buffer = null;
        context = null;
        endedCallback = null;
        sourceNode = null;
    };

    /*
     * Getters & Setters
     */

    Object.defineProperties(api, {
        play: {
            value: play
        },
        pause: {
            value: pause
        },
        stop: {
            value: stop
        },
        destroy: {
            value: destroy
        },
        currentTime: {
            get: function get() {
                if (pausedAt) {
                    return pausedAt;
                }
                if (startedAt) {
                    var time = context.currentTime - startedAt;
                    if (time > api.duration) {
                        time = time % api.duration;
                    }
                    return time;
                }
                return 0;
            }
        },
        duration: {
            get: function get() {
                return buffer ? buffer.duration : 0;
            }
        },
        ended: {
            get: function get() {
                return ended;
            }
        },
        loop: {
            get: function get() {
                return loop;
            },
            set: function set(value) {
                loop = !!value;
                if (sourceNode) {
                    sourceNode.loop = loop;
                }
            }
        },
        paused: {
            get: function get() {
                return paused;
            }
        },
        playbackRate: {
            get: function get() {
                return playbackRate;
            },
            set: function set(value) {
                playbackRate = value;
                if (sourceNode) {
                    sourceNode.playbackRate.value = playbackRate;
                }
            }
        },
        playing: {
            get: function get() {
                return playing;
            }
        },
        progress: {
            get: function get() {
                return api.duration ? api.currentTime / api.duration : 0;
            }
        },
        sourceNode: {
            get: function get() {
                return createSourceNode();
            }
        }
    });

    return Object.freeze(api);
}

module.exports = BufferSource;

},{}],35:[function(require,module,exports){
'use strict';

function MediaSource(el, context, onEnded) {
    var ended = false,
        endedCallback = onEnded,
        delayTimeout,
        fadeTimeout,
        loop = false,
        paused = false,
        playbackRate = 1,
        playing = false,
        sourceNode = null,
        groupVolume = 1,
        volume = 1,
        api = {};

    var createSourceNode = function createSourceNode() {
        if (!sourceNode && context) {
            sourceNode = context.createMediaElementSource(el);
        }
        return sourceNode;
    };

    /*
     * Load
     */

    var load = function load(url) {
        el.src = url;
        el.load();
        ended = false;
        paused = false;
        playing = false;
    };

    /*
     * Controls
     */

    var play = function play(delay, offset) {
        clearTimeout(delayTimeout);

        el.volume = volume * groupVolume;
        el.playbackRate = playbackRate;

        if (offset) {
            el.currentTime = offset;
        }

        if (delay) {
            delayTimeout = setTimeout(play, delay);
        } else {
            // el.load();
            el.play();
        }

        ended = false;
        paused = false;
        playing = true;

        el.removeEventListener('ended', endedHandler);
        el.addEventListener('ended', endedHandler, false);

        if (el.readyState < 4) {
            el.removeEventListener('canplaythrough', readyHandler);
            el.addEventListener('canplaythrough', readyHandler, false);
            el.load();
            el.play();
        }
    };

    var readyHandler = function readyHandler() {
        el.removeEventListener('canplaythrough', readyHandler);
        if (playing) {
            el.play();
        }
    };

    var pause = function pause() {
        clearTimeout(delayTimeout);

        if (!el) {
            return;
        }

        el.pause();
        playing = false;
        paused = true;
    };

    var stop = function stop() {
        clearTimeout(delayTimeout);

        if (!el) {
            return;
        }

        el.pause();

        try {
            el.currentTime = 0;
            // fixes bug where server doesn't support seek:
            if (el.currentTime > 0) {
                el.load();
            }
        } catch (e) {}

        playing = false;
        paused = false;
    };

    /*
     * Fade for no webaudio
     */

    var fade = function fade(toVolume, duration) {
        if (context) {
            return api;
        }

        function ramp(value, step) {
            fadeTimeout = setTimeout(function () {
                api.volume = api.volume + (value - api.volume) * 0.2;
                if (Math.abs(api.volume - value) > 0.05) {
                    return ramp(value, step);
                }
                api.volume = value;
            }, step * 1000);
        }

        window.clearTimeout(fadeTimeout);
        ramp(toVolume, duration / 10);

        return api;
    };

    /*
     * Ended handler
     */

    var endedHandler = function endedHandler() {
        ended = true;
        paused = false;
        playing = false;

        if (loop) {
            el.currentTime = 0;
            // fixes bug where server doesn't support seek:
            if (el.currentTime > 0) {
                el.load();
            }
            play();
        } else if (typeof endedCallback === 'function') {
            endedCallback(api);
        }
    };

    /*
     * Destroy
     */

    var destroy = function destroy() {
        el.removeEventListener('ended', endedHandler);
        el.removeEventListener('canplaythrough', readyHandler);
        stop();
        el = null;
        context = null;
        endedCallback = null;
        sourceNode = null;
    };

    /*
     * Getters & Setters
     */

    Object.defineProperties(api, {
        play: {
            value: play
        },
        pause: {
            value: pause
        },
        stop: {
            value: stop
        },
        load: {
            value: load
        },
        fade: {
            value: fade
        },
        destroy: {
            value: destroy
        },
        currentTime: {
            get: function get() {
                return el ? el.currentTime : 0;
            }
        },
        duration: {
            get: function get() {
                return el ? el.duration : 0;
            }
        },
        ended: {
            get: function get() {
                return ended;
            }
        },
        loop: {
            get: function get() {
                return loop;
            },
            set: function set(value) {
                loop = !!value;
            }
        },
        paused: {
            get: function get() {
                return paused;
            }
        },
        playbackRate: {
            get: function get() {
                return playbackRate;
            },
            set: function set(value) {
                playbackRate = value;
                if (el) {
                    el.playbackRate = playbackRate;
                }
            }
        },
        playing: {
            get: function get() {
                return playing;
            }
        },
        progress: {
            get: function get() {
                return el && el.duration ? el.currentTime / el.duration : 0;
            }
        },
        sourceNode: {
            get: function get() {
                return createSourceNode();
            }
        },
        volume: {
            get: function get() {
                return volume;
            },
            set: function set(value) {
                window.clearTimeout(fadeTimeout);
                volume = value;
                if (el) {
                    el.volume = volume * groupVolume;
                }
            }
        },
        groupVolume: {
            get: function get() {
                return groupVolume;
            },
            set: function set(value) {
                groupVolume = value;
                if (el) {
                    el.volume = volume * groupVolume;
                }
            }
        }
    });

    return Object.freeze(api);
}

module.exports = MediaSource;

},{}],36:[function(require,module,exports){
'use strict';

function MicrophoneSource(stream, context) {
    var ended = false,
        paused = false,
        pausedAt = 0,
        playing = false,
        sourceNode = null,
        // MicrophoneSourceNode
    startedAt = 0;

    var createSourceNode = function createSourceNode() {
        if (!sourceNode && context) {
            sourceNode = context.createMediaStreamSource(stream);
            // HACK: stops moz garbage collection killing the stream
            // see https://support.mozilla.org/en-US/questions/984179
            if (navigator.mozGetUserMedia) {
                window.mozHack = sourceNode;
            }
        }
        return sourceNode;
    };

    /*
     * Controls
     */

    var play = function play(delay) {
        delay = delay ? context.currentTime + delay : 0;

        createSourceNode();
        sourceNode.start(delay);

        startedAt = context.currentTime - pausedAt;
        ended = false;
        playing = true;
        paused = false;
        pausedAt = 0;
    };

    var pause = function pause() {
        var elapsed = context.currentTime - startedAt;
        stop();
        pausedAt = elapsed;
        playing = false;
        paused = true;
    };

    var stop = function stop() {
        if (sourceNode) {
            try {
                sourceNode.stop(0);
            } catch (e) {}
            sourceNode = null;
        }
        ended = true;
        paused = false;
        pausedAt = 0;
        playing = false;
        startedAt = 0;
    };

    /*
     * Destroy
     */

    var destroy = function destroy() {
        stop();
        context = null;
        sourceNode = null;
        stream = null;
        window.mozHack = null;
    };

    /*
     * Api
     */

    var api = {
        play: play,
        pause: pause,
        stop: stop,
        destroy: destroy,

        duration: 0,
        progress: 0
    };

    /*
     * Getters & Setters
     */

    Object.defineProperties(api, {
        currentTime: {
            get: function get() {
                if (pausedAt) {
                    return pausedAt;
                }
                if (startedAt) {
                    return context.currentTime - startedAt;
                }
                return 0;
            }
        },
        ended: {
            get: function get() {
                return ended;
            }
        },
        paused: {
            get: function get() {
                return paused;
            }
        },
        playing: {
            get: function get() {
                return playing;
            }
        },
        sourceNode: {
            get: function get() {
                return createSourceNode();
            }
        }
    });

    return Object.freeze(api);
}

module.exports = MicrophoneSource;

},{}],37:[function(require,module,exports){
'use strict';

function OscillatorSource(type, context) {
    var ended = false,
        paused = false,
        pausedAt = 0,
        playing = false,
        sourceNode = null,
        // OscillatorSourceNode
    startedAt = 0,
        frequency = 200,
        api;

    var createSourceNode = function createSourceNode() {
        if (!sourceNode && context) {
            sourceNode = context.createOscillator();
            sourceNode.type = type;
            sourceNode.frequency.value = frequency;
        }
        return sourceNode;
    };

    /*
     * Controls
     */

    var play = function play(delay) {
        delay = delay || 0;
        if (delay) {
            delay = context.currentTime + delay;
        }

        createSourceNode();
        sourceNode.start(delay);

        if (pausedAt) {
            startedAt = context.currentTime - pausedAt;
        } else {
            startedAt = context.currentTime;
        }

        ended = false;
        playing = true;
        paused = false;
        pausedAt = 0;
    };

    var pause = function pause() {
        var elapsed = context.currentTime - startedAt;
        this.stop();
        pausedAt = elapsed;
        playing = false;
        paused = true;
    };

    var stop = function stop() {
        if (sourceNode) {
            try {
                sourceNode.stop(0);
            } catch (e) {}
            sourceNode = null;
        }
        ended = true;
        paused = false;
        pausedAt = 0;
        playing = false;
        startedAt = 0;
    };

    /*
     * Destroy
     */

    var destroy = function destroy() {
        this.stop();
        context = null;
        sourceNode = null;
    };

    /*
     * Api
     */

    api = {
        play: play,
        pause: pause,
        stop: stop,
        destroy: destroy
    };

    /*
     * Getters & Setters
     */

    Object.defineProperties(api, {
        currentTime: {
            get: function get() {
                if (pausedAt) {
                    return pausedAt;
                }
                if (startedAt) {
                    return context.currentTime - startedAt;
                }
                return 0;
            }
        },
        duration: {
            value: 0
        },
        ended: {
            get: function get() {
                return ended;
            }
        },
        frequency: {
            get: function get() {
                return frequency;
            },
            set: function set(value) {
                frequency = value;
                if (sourceNode) {
                    sourceNode.frequency.value = value;
                }
            }
        },
        paused: {
            get: function get() {
                return paused;
            }
        },
        playing: {
            get: function get() {
                return playing;
            }
        },
        progress: {
            value: 0
        },
        sourceNode: {
            get: function get() {
                return createSourceNode();
            }
        }
    });

    return Object.freeze(api);
}

module.exports = OscillatorSource;

},{}],38:[function(require,module,exports){
'use strict';

function ScriptSource(data, context) {
    var bufferSize = data.bufferSize || 1024,
        channels = data.channels || 1,
        ended = false,
        onProcess = data.callback.bind(data.thisArg || this),
        paused = false,
        pausedAt = 0,
        playing = false,
        sourceNode = null,
        // ScriptSourceNode
    startedAt = 0,
        api;

    var createSourceNode = function createSourceNode() {
        if (!sourceNode && context) {
            sourceNode = context.createScriptProcessor(bufferSize, 0, channels);
        }
        return sourceNode;
    };

    /*
     * Controls
     */

    var play = function play(delay) {
        delay = delay ? context.currentTime + delay : 0;

        createSourceNode();
        sourceNode.onaudioprocess = onProcess;

        startedAt = context.currentTime - pausedAt;
        ended = false;
        paused = false;
        pausedAt = 0;
        playing = true;
    };

    var pause = function pause() {
        var elapsed = context.currentTime - startedAt;
        this.stop();
        pausedAt = elapsed;
        playing = false;
        paused = true;
    };

    var stop = function stop() {
        if (sourceNode) {
            sourceNode.onaudioprocess = onPaused;
        }
        ended = true;
        paused = false;
        pausedAt = 0;
        playing = false;
        startedAt = 0;
    };

    var onPaused = function onPaused(event) {
        var buffer = event.outputBuffer;
        for (var i = 0; i < buffer.numberOfChannels; i++) {
            var channel = buffer.getChannelData(i);
            for (var j = 0; j < channel.length; j++) {
                channel[j] = 0;
            }
        }
    };

    /*
     * Destroy
     */

    var destroy = function destroy() {
        this.stop();
        context = null;
        onProcess = null;
        sourceNode = null;
    };

    /*
     * Api
     */

    api = {
        play: play,
        pause: pause,
        stop: stop,
        destroy: destroy,

        duration: 0,
        progress: 0
    };

    /*
     * Getters & Setters
     */

    Object.defineProperties(api, {
        currentTime: {
            get: function get() {
                if (pausedAt) {
                    return pausedAt;
                }
                if (startedAt) {
                    return context.currentTime - startedAt;
                }
                return 0;
            }
        },
        ended: {
            get: function get() {
                return ended;
            }
        },
        paused: {
            get: function get() {
                return paused;
            }
        },
        playing: {
            get: function get() {
                return playing;
            }
        },
        sourceNode: {
            get: function get() {
                return createSourceNode();
            }
        }
    });

    return Object.freeze(api);
}

module.exports = ScriptSource;

},{}],39:[function(require,module,exports){
'use strict';

var browser = {};

browser.handlePageVisibility = function (onHidden, onShown) {
    var hidden, visibilityChange;

    if (typeof document.hidden !== 'undefined') {
        hidden = 'hidden';
        visibilityChange = 'visibilitychange';
    } else if (typeof document.mozHidden !== 'undefined') {
        hidden = 'mozHidden';
        visibilityChange = 'mozvisibilitychange';
    } else if (typeof document.msHidden !== 'undefined') {
        hidden = 'msHidden';
        visibilityChange = 'msvisibilitychange';
    } else if (typeof document.webkitHidden !== 'undefined') {
        hidden = 'webkitHidden';
        visibilityChange = 'webkitvisibilitychange';
    }

    function onChange() {
        if (document[hidden]) {
            onHidden();
        } else {
            onShown();
        }
    }

    if (visibilityChange !== undefined) {
        document.addEventListener(visibilityChange, onChange, false);
    }
};

browser.handleTouchLock = function (context, onUnlock) {
    var ua = navigator.userAgent,
        locked = !!ua.match(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|SymbianOS/i);

    var unlock = function unlock() {
        document.body.removeEventListener('touchstart', unlock);

        if (context) {
            var buffer = context.createBuffer(1, 1, 22050);
            var source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);
            source.disconnect();
        }

        onUnlock();
    };

    if (locked) {
        document.body.addEventListener('touchstart', unlock, false);
    }
    return locked;
};

module.exports = browser;

},{}],40:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;

function Emitter() {
    EventEmitter.call(this);
    this.setMaxListeners(20);
}

Emitter.prototype = Object.create(EventEmitter.prototype);
Emitter.prototype.constructor = Emitter;

Emitter.prototype.off = function (type, listener) {
    if (listener) {
        return this.removeListener(type, listener);
    }
    if (type) {
        return this.removeAllListeners(type);
    }
    return this.removeAllListeners();
};

module.exports = Emitter;

},{"events":8}],41:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var File = {
    extensions: [],
    canPlay: {}
};

/*
 * Initial tests
 */

var tests = [{ ext: 'ogg', type: 'audio/ogg; codecs="vorbis"' }, { ext: 'mp3', type: 'audio/mpeg;' }, { ext: 'opus', type: 'audio/ogg; codecs="opus"' }, { ext: 'wav', type: 'audio/wav; codecs="1"' }, { ext: 'm4a', type: 'audio/x-m4a;' }, { ext: 'm4a', type: 'audio/aac;' }];

var el = document.createElement('audio');
if (el) {
    tests.forEach(function (test) {
        var canPlayType = !!el.canPlayType(test.type);
        if (canPlayType && File.extensions.indexOf(test.ext) === -1) {
            File.extensions.push(test.ext);
        }
        File.canPlay[test.ext] = canPlayType;
    });
    el = null;
}

/*
 * find a supported file
 */

File.getFileExtension = function (url) {
    // from DataURL
    if (url.slice(0, 5) === 'data:') {
        var match = url.match(/data:audio\/(ogg|mp3|opus|wav|m4a)/i);
        if (match && match.length > 1) {
            return match[1].toLowerCase();
        }
    }
    // from Standard URL
    url = url.split('?')[0];
    url = url.slice(url.lastIndexOf('/') + 1);

    var a = url.split('.');
    if (a.length === 1 || a[0] === '' && a.length === 2) {
        return '';
    }
    return a.pop().toLowerCase();
};

File.getSupportedFile = function (fileNames) {
    var name;

    if (Array.isArray(fileNames)) {
        // if array get the first one that works
        fileNames.some(function (item) {
            name = item;
            var ext = this.getFileExtension(item);
            return this.extensions.indexOf(ext) > -1;
        }, this);
    } else if ((typeof fileNames === 'undefined' ? 'undefined' : _typeof(fileNames)) === 'object') {
        // if not array and is object
        Object.keys(fileNames).some(function (key) {
            name = fileNames[key];
            var ext = this.getFileExtension(name);
            return this.extensions.indexOf(ext) > -1;
        }, this);
    }
    // if string just return
    return name || fileNames;
};

/*
 * infer file types
 */

File.isAudioBuffer = function (data) {
    return !!(data && window.AudioBuffer && data instanceof window.AudioBuffer);
};

File.isMediaElement = function (data) {
    return !!(data && window.HTMLMediaElement && data instanceof window.HTMLMediaElement);
};

File.isMediaStream = function (data) {
    return !!(data && typeof data.getAudioTracks === 'function' && data.getAudioTracks().length && window.MediaStreamTrack && data.getAudioTracks()[0] instanceof window.MediaStreamTrack);
};

File.isOscillatorType = function (data) {
    return !!(data && typeof data === 'string' && (data === 'sine' || data === 'square' || data === 'sawtooth' || data === 'triangle'));
};

File.isScriptConfig = function (data) {
    return !!(data && (typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object' && data.bufferSize && data.channels && data.callback);
};

File.isURL = function (data) {
    return !!(data && typeof data === 'string' && (data.indexOf('.') > -1 || data.slice(0, 5) === 'data:'));
};

File.containsURL = function (config) {
    if (!config || this.isMediaElement(config)) {
        return false;
    }
    // string, array or object with src property that is string or array
    var src = config.src || config.url || config;
    return this.isURL(src) || Array.isArray(src) && this.isURL(src[0]);
};

module.exports = File;

},{}],42:[function(require,module,exports){
'use strict';

var Emitter = require('./emitter.js');

function Loader(url) {
    var emitter = new Emitter(),
        progress = 0,
        audioContext,
        isTouchLocked,
        request,
        timeout,
        data,
        ERROR_STATE = ['', 'ABORTED', 'NETWORK', 'DECODE', 'SRC_NOT_SUPPORTED'];

    var start = function start() {
        if (audioContext) {
            loadArrayBuffer();
        } else {
            loadAudioElement();
        }
    };

    var dispatchComplete = function dispatchComplete(buffer) {
        emitter.emit('progress', 1);
        emitter.emit('loaded', buffer);
        emitter.emit('complete', buffer);

        removeListeners();
    };

    // audio buffer

    var loadArrayBuffer = function loadArrayBuffer() {
        request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.addEventListener('progress', progressHandler);
        request.addEventListener('load', loadHandler);
        request.addEventListener('error', errorHandler);
        request.send();
    };

    var progressHandler = function progressHandler(event) {
        if (event.lengthComputable) {
            progress = event.loaded / event.total;
            emitter.emit('progress', progress);
        }
    };

    var loadHandler = function loadHandler() {
        audioContext.decodeAudioData(request.response, function (buffer) {
            data = buffer;
            request = null;
            progress = 1;
            dispatchComplete(buffer);
        }, errorHandler);
    };

    // audio element

    var loadAudioElement = function loadAudioElement() {
        if (!data || !data.tagName) {
            data = document.createElement('audio');
        }

        if (!isTouchLocked) {
            // timeout because sometimes canplaythrough doesn't fire
            window.clearTimeout(timeout);
            timeout = window.setTimeout(readyHandler, 2000);
            data.addEventListener('canplaythrough', readyHandler, false);
        }

        data.addEventListener('error', errorHandler, false);
        data.preload = 'auto';
        data.src = url;
        data.load();

        if (isTouchLocked) {
            dispatchComplete(data);
        }
    };

    var readyHandler = function readyHandler() {
        window.clearTimeout(timeout);
        if (!data) {
            return;
        }
        progress = 1;
        dispatchComplete(data);
    };

    // error

    var errorHandler = function errorHandler(event) {
        window.clearTimeout(timeout);

        var message = event;

        if (data && data.error) {
            message = 'Media Error: ' + ERROR_STATE[data.error.code] + ' ' + url;
        }

        if (request) {
            message = 'XHR Error: ' + request.status + ' ' + request.statusText + ' ' + url;
        }

        emitter.emit('error', message);

        removeListeners();
    };

    // clean up

    var removeListeners = function removeListeners() {
        emitter.off('error');
        emitter.off('progress');
        emitter.off('complete');
        emitter.off('loaded');

        if (data && typeof data.removeEventListener === 'function') {
            data.removeEventListener('canplaythrough', readyHandler);
            data.removeEventListener('error', errorHandler);
        }

        if (request) {
            request.removeEventListener('progress', progressHandler);
            request.removeEventListener('load', loadHandler);
            request.removeEventListener('error', errorHandler);
        }
    };

    var cancel = function cancel() {
        removeListeners();

        if (request && request.readyState !== 4) {
            request.abort();
        }
        request = null;

        window.clearTimeout(timeout);
    };

    var destroy = function destroy() {
        cancel();
        request = null;
        data = null;
        audioContext = null;
    };

    // reload

    var load = function load(newUrl) {
        url = newUrl;
        start();
    };

    var api = {
        on: emitter.on.bind(emitter),
        once: emitter.once.bind(emitter),
        off: emitter.off.bind(emitter),
        load: load,
        start: start,
        cancel: cancel,
        destroy: destroy
    };

    Object.defineProperties(api, {
        data: {
            get: function get() {
                return data;
            }
        },
        progress: {
            get: function get() {
                return progress;
            }
        },
        audioContext: {
            set: function set(value) {
                audioContext = value;
            }
        },
        isTouchLocked: {
            set: function set(value) {
                isTouchLocked = value;
            }
        }
    });

    return Object.freeze(api);
}

Loader.Group = function () {
    var emitter = new Emitter(),
        queue = [],
        numLoaded = 0,
        numTotal = 0,
        loader;

    var add = function add(loader) {
        queue.push(loader);
        numTotal++;
        return loader;
    };

    var start = function start() {
        numTotal = queue.length;
        next();
    };

    var next = function next() {
        if (queue.length === 0) {
            loader = null;
            emitter.emit('complete');
            return;
        }

        loader = queue.pop();
        loader.on('progress', progressHandler);
        loader.once('loaded', completeHandler);
        loader.once('error', errorHandler);
        loader.start();
    };

    var progressHandler = function progressHandler(progress) {
        var loaded = numLoaded + progress;
        emitter.emit('progress', loaded / numTotal);
    };

    var completeHandler = function completeHandler() {
        numLoaded++;
        removeListeners();
        emitter.emit('progress', numLoaded / numTotal);
        next();
    };

    var errorHandler = function errorHandler(e) {
        console.error.call(console, e);
        removeListeners();
        emitter.emit('error', e);
        next();
    };

    var removeListeners = function removeListeners() {
        loader.off('progress', progressHandler);
        loader.off('loaded', completeHandler);
        loader.off('error', errorHandler);
    };

    return Object.freeze({
        on: emitter.on.bind(emitter),
        once: emitter.once.bind(emitter),
        off: emitter.off.bind(emitter),
        add: add,
        start: start
    });
};

module.exports = Loader;

},{"./emitter.js":40}],43:[function(require,module,exports){
'use strict';

function Microphone(connected, denied, error) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    error = error || function () {};

    var isSupported = !!navigator.getUserMedia,
        stream = null,
        api = {};

    var connect = function connect() {
        if (!isSupported) {
            return;
        }

        navigator.getUserMedia({ audio: true }, function (micStream) {
            stream = micStream;
            connected(stream);
        }, function (e) {
            if (denied && e.name === 'PermissionDeniedError' || e === 'PERMISSION_DENIED') {
                // console.log('Permission denied. Reset by clicking the camera icon with the red cross in the address bar');
                denied();
            } else {
                error(e.message || e);
            }
        });
        return api;
    };

    var disconnect = function disconnect() {
        if (stream) {
            stream.stop();
            stream = null;
        }
        return api;
    };

    Object.defineProperties(api, {
        connect: {
            value: connect
        },
        disconnect: {
            value: disconnect
        },
        isSupported: {
            value: isSupported
        },
        stream: {
            get: function get() {
                return stream;
            }
        }
    });

    return Object.freeze(api);
}

module.exports = Microphone;

},{}],44:[function(require,module,exports){
'use strict';

var Group = require('../group.js');

function SoundGroup(context, destination) {
    var group = new Group(context, destination),
        sounds = group.sounds,
        playbackRate = 1,
        loop = false,
        src;

    var getSource = function getSource() {
        if (!sounds.length) {
            return;
        }

        src = sounds.slice(0).sort(function (a, b) {
            return b.duration - a.duration;
        })[0];
    };

    var add = group.add;
    group.add = function (sound) {
        add(sound);
        getSource();
        return group;
    };

    var remove = group.rmeove;
    group.remove = function (soundOrId) {
        remove(soundOrId);
        getSource();
        return group;
    };

    Object.defineProperties(group, {
        currentTime: {
            get: function get() {
                return src ? src.currentTime : 0;
            },
            set: function set(value) {
                this.stop();
                this.play(0, value);
            }
        },
        duration: {
            get: function get() {
                return src ? src.duration : 0;
            }
        },
        // ended: {
        //     get: function() {
        //         return src ? src.ended : false;
        //     }
        // },
        loop: {
            get: function get() {
                return loop;
            },
            set: function set(value) {
                loop = !!value;
                sounds.forEach(function (sound) {
                    sound.loop = loop;
                });
            }
        },
        paused: {
            get: function get() {
                // return src ? src.paused : false;
                return !!src && src.paused;
            }
        },
        progress: {
            get: function get() {
                return src ? src.progress : 0;
            }
        },
        playbackRate: {
            get: function get() {
                return playbackRate;
            },
            set: function set(value) {
                playbackRate = value;
                sounds.forEach(function (sound) {
                    sound.playbackRate = playbackRate;
                });
            }
        },
        playing: {
            get: function get() {
                // return src ? src.playing : false;
                return !!src && src.playing;
            }
        }
    });

    return group;
}

module.exports = SoundGroup;

},{"../group.js":32}],45:[function(require,module,exports){
'use strict';

var Microphone = require('./microphone.js');
var waveformer = require('./waveformer.js');

/*
 * audio audioContext
 */
var audioContext;

var setContext = function setContext(value) {
    audioContext = value;
};

/*
 * clone audio buffer
 */

var cloneBuffer = function cloneBuffer(buffer) {
    if (!audioContext) {
        return buffer;
    }

    var numChannels = buffer.numberOfChannels,
        cloned = audioContext.createBuffer(numChannels, buffer.length, buffer.sampleRate);
    for (var i = 0; i < numChannels; i++) {
        cloned.getChannelData(i).set(buffer.getChannelData(i));
    }
    return cloned;
};

/*
 * reverse audio buffer
 */

var reverseBuffer = function reverseBuffer(buffer) {
    var numChannels = buffer.numberOfChannels;
    for (var i = 0; i < numChannels; i++) {
        Array.prototype.reverse.call(buffer.getChannelData(i));
    }
    return buffer;
};

/*
 * ramp audio param
 */

var ramp = function ramp(param, fromValue, toValue, duration, linear) {
    if (!audioContext) {
        return;
    }

    param.setValueAtTime(fromValue, audioContext.currentTime);

    if (linear) {
        param.linearRampToValueAtTime(toValue, audioContext.currentTime + duration);
    } else {
        param.exponentialRampToValueAtTime(toValue, audioContext.currentTime + duration);
    }
};

/*
 * get frequency from min to max by passing 0 to 1
 */

var getFrequency = function getFrequency(value) {
    if (!audioContext) {
        return 0;
    }
    // get frequency by passing number from 0 to 1
    // Clamp the frequency between the minimum value (40 Hz) and half of the
    // sampling rate.
    var minValue = 40;
    var maxValue = audioContext.sampleRate / 2;
    // Logarithm (base 2) to compute how many octaves fall in the range.
    var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
    // Compute a multiplier from 0 to 1 based on an exponential scale.
    var multiplier = Math.pow(2, numberOfOctaves * (value - 1.0));
    // Get back to the frequency value between min and max.
    return maxValue * multiplier;
};

/*
 * microphone util
 */

var microphone = function microphone(connected, denied, error) {
    return new Microphone(connected, denied, error);
};

/*
 * Format seconds as timecode string
 */

var timeCode = function timeCode(seconds, delim) {
    if (delim === undefined) {
        delim = ':';
    }
    var h = Math.floor(seconds / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 3600 % 60);
    var hr = h === 0 ? '' : h < 10 ? '0' + h + delim : h + delim;
    var mn = (m < 10 ? '0' + m : m) + delim;
    var sc = s < 10 ? '0' + s : s;
    return hr + mn + sc;
};

module.exports = Object.freeze({
    setContext: setContext,
    cloneBuffer: cloneBuffer,
    reverseBuffer: reverseBuffer,
    ramp: ramp,
    getFrequency: getFrequency,
    microphone: microphone,
    timeCode: timeCode,
    waveformer: waveformer
});

},{"./microphone.js":43,"./waveformer.js":48}],46:[function(require,module,exports){
'use strict';

module.exports = Object.freeze({
  number: function number(value, defaultValue) {
    if (arguments.length < 2) {
      defaultValue = 0;
    }
    if (typeof value !== 'number' || isNaN(value)) {
      return defaultValue;
    }
    return value;
  }
});

},{}],47:[function(require,module,exports){
'use strict';

function waveform() {

    var buffer, wave;

    return function (audioBuffer, length) {
        if (!window.Float32Array || !window.AudioBuffer) {
            return [];
        }

        var sameBuffer = buffer === audioBuffer;
        var sameLength = wave && wave.length === length;
        if (sameBuffer && sameLength) {
            return wave;
        }

        //console.time('waveData');
        if (!wave || wave.length !== length) {
            wave = new Float32Array(length);
        }

        if (!audioBuffer) {
            return wave;
        }

        // cache for repeated calls
        buffer = audioBuffer;

        var chunk = Math.floor(buffer.length / length),
            resolution = 5,
            // 10
        incr = Math.max(Math.floor(chunk / resolution), 1),
            greatest = 0;

        for (var i = 0; i < buffer.numberOfChannels; i++) {
            // check each channel
            var channel = buffer.getChannelData(i);
            for (var j = 0; j < length; j++) {
                // get highest value within the chunk
                for (var k = j * chunk, l = k + chunk; k < l; k += incr) {
                    // select highest value from channels
                    var a = channel[k];
                    if (a < 0) {
                        a = -a;
                    }
                    if (a > wave[j]) {
                        wave[j] = a;
                    }
                    // update highest overall for scaling
                    if (a > greatest) {
                        greatest = a;
                    }
                }
            }
        }
        // scale up
        var scale = 1 / greatest;
        for (i = 0; i < wave.length; i++) {
            wave[i] *= scale;
        }
        //console.timeEnd('waveData');

        return wave;
    };
}

module.exports = waveform;

},{}],48:[function(require,module,exports){
'use strict';

var halfPI = Math.PI / 2;
var twoPI = Math.PI * 2;

module.exports = function waveformer(config) {

  var style = config.style || 'fill',
      // 'fill' or 'line'
  shape = config.shape || 'linear',
      // 'circular' or 'linear'
  color = config.color || 0,
      bgColor = config.bgColor,
      lineWidth = config.lineWidth || 1,
      percent = config.percent || 1,
      originX = config.x || 0,
      originY = config.y || 0,
      transform = config.transform,
      canvas = config.canvas,
      width = config.width || canvas && canvas.width,
      height = config.height || canvas && canvas.height,
      ctx,
      currentColor,
      waveform,
      length,
      i,
      value,
      x,
      y,
      radius,
      innerRadius,
      centerX,
      centerY;

  if (!canvas && !config.context) {
    canvas = document.createElement('canvas');
    width = width || canvas.width;
    height = height || canvas.height;
    canvas.width = height;
    canvas.height = height;
  }

  if (shape === 'circular') {
    radius = config.radius || Math.min(height / 2, width / 2), innerRadius = config.innerRadius || radius / 2;
    centerX = originX + width / 2;
    centerY = originY + height / 2;
  }

  ctx = config.context || canvas.getContext('2d');

  var clear = function clear() {
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(originX, originY, width, height);
    } else {
      ctx.clearRect(originX, originY, width, height);
    }

    ctx.lineWidth = lineWidth;

    currentColor = null;

    if (typeof color !== 'function') {
      ctx.strokeStyle = color;
      ctx.beginPath();
    }
  };

  var updateColor = function updateColor(position, length, value) {
    if (typeof color === 'function') {
      var newColor = color(position, length, value);
      if (newColor !== currentColor) {
        currentColor = newColor;
        ctx.stroke();
        ctx.strokeStyle = currentColor;
        ctx.beginPath();
      }
    }
  };

  var getValue = function getValue(value, position, length) {
    if (typeof transform === 'function') {
      return transform(value, position, length);
    }
    return value;
  };

  var getWaveform = function getWaveform(value, length) {
    if (value && typeof value.waveform === 'function') {
      return value.waveform(length);
    }
    if (value) {
      return value;
    }
    if (config.waveform) {
      return config.waveform;
    }
    if (config.sound) {
      return config.sound.waveform(length);
    }
    return null;
  };

  var update = function update(wave) {

    clear();

    if (shape === 'circular') {

      waveform = getWaveform(wave, 360);
      length = Math.floor(waveform.length * percent);

      var step = twoPI / length,
          angle,
          magnitude,
          sine,
          cosine;

      for (i = 0; i < length; i++) {
        value = getValue(waveform[i], i, length);
        updateColor(i, length, value);

        angle = i * step - halfPI;
        cosine = Math.cos(angle);
        sine = Math.sin(angle);

        if (style === 'fill') {
          x = centerX + innerRadius * cosine;
          y = centerY + innerRadius * sine;
          ctx.moveTo(x, y);
        }

        magnitude = innerRadius + (radius - innerRadius) * value;
        x = centerX + magnitude * cosine;
        y = centerY + magnitude * sine;

        if (style === 'line' && i === 0) {
          ctx.moveTo(x, y);
        }

        ctx.lineTo(x, y);
      }

      if (style === 'line') {
        ctx.closePath();
      }
    } else {

      waveform = getWaveform(wave, width);
      length = Math.min(waveform.length, width - lineWidth / 2);
      length = Math.floor(length * percent);

      for (i = 0; i < length; i++) {
        value = getValue(waveform[i], i, length);
        updateColor(i, length, value);

        if (style === 'line' && i > 0) {
          ctx.lineTo(x, y);
        }

        x = originX + i;
        y = originY + height - Math.round(height * value);
        y = Math.floor(Math.min(y, originY + height - lineWidth / 2));

        if (style === 'fill') {
          ctx.moveTo(x, y);
          ctx.lineTo(x, originY + height);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
  };

  update.canvas = canvas;

  if (config.waveform || config.sound) {
    update();
  }

  return update;
};

},{}],49:[function(require,module,exports){
'use strict';

var browser = require('./lib/utils/browser.js'),
    file = require('./lib/utils/file.js'),
    Group = require('./lib/group.js'),
    Loader = require('./lib/utils/loader.js'),
    Sound = require('./lib/sound.js'),
    SoundGroup = require('./lib/utils/sound-group.js'),
    utils = require('./lib/utils/utils.js');

function Sono() {
    var VERSION = '0.0.9',
        Ctx = window.AudioContext || window.webkitAudioContext,
        context = Ctx ? new Ctx() : null,
        destination = context ? context.destination : null,
        group = new Group(context, destination),
        api;

    utils.setContext(context);

    /*
     * Create Sound
     *
     * Accepted values for param config:
     * Object config e.g. { id:'foo', url:['foo.ogg', 'foo.mp3'] }
     * Array (of files e.g. ['foo.ogg', 'foo.mp3'])
     * ArrayBuffer
     * HTMLMediaElement
     * Filename string (e.g. 'foo.ogg')
     * Oscillator type string (i.e. 'sine', 'square', 'sawtooth', 'triangle')
     * ScriptProcessor config object (e.g. { bufferSize: 1024, channels: 1, callback: fn })
     */

    var createSound = function createSound(config) {
        // try to load if config contains URLs
        if (file.containsURL(config)) {
            return load(config);
        }

        var sound = add(config);
        sound.data = config.data || config;

        return sound;
    };

    /*
     * Destroy
     */

    var destroySound = function destroySound(soundOrId) {
        group.find(soundOrId, function (sound) {
            sound.destroy();
        });
        return api;
    };

    var destroyAll = function destroyAll() {
        group.destroy();
        return api;
    };

    /*
     * Get Sound by id
     */

    var getSound = function getSound(id) {
        return group.find(id);
    };

    /*
     * Create group
     */

    var createGroup = function createGroup(sounds) {
        var soundGroup = new SoundGroup(context, group.gain);
        if (sounds) {
            sounds.forEach(function (sound) {
                soundGroup.add(sound);
            });
        }
        return soundGroup;
    };

    /*
     * Loading
     */

    var load = function load(config) {
        var src = config.src || config.url || config,
            sound,
            loader;

        if (file.containsURL(src)) {
            sound = queue(config);
            loader = sound.loader;
        } else if (Array.isArray(src) && file.containsURL(src[0].src || src[0].url)) {
            sound = [];
            loader = new Loader.Group();
            src.forEach(function (file) {
                sound.push(queue(file, loader));
            });
        } else {
            var errorMessage = 'sono.load: No audio file URLs found in config.';
            if (config.onError) {
                config.onError('[ERROR] ' + errorMessage);
            } else {
                throw new Error(errorMessage);
            }
            return null;
        }
        if (config.onProgress) {
            loader.on('progress', function (progress) {
                config.onProgress(progress);
            });
        }
        if (config.onComplete) {
            loader.once('complete', function () {
                loader.off('progress');
                config.onComplete(sound);
            });
        }
        loader.once('error', function (err) {
            loader.off('error');
            if (config.onError) {
                config.onError(err);
            } else {
                console.error.call(console, '[ERROR] sono.load: ' + err);
            }
        });
        loader.start();

        return sound;
    };

    var queue = function queue(config, loaderGroup) {
        var sound = add(config).load(config);

        if (loaderGroup) {
            loaderGroup.add(sound.loader);
        }
        return sound;
    };

    var add = function add(config) {
        var soundContext = config && config.webAudio === false ? null : context;
        var sound = new Sound(soundContext, group.gain);
        sound.isTouchLocked = isTouchLocked;
        if (config) {
            sound.id = config.id || '';
            sound.loop = !!config.loop;
            sound.volume = config.volume;
        }
        group.add(sound);
        return sound;
    };

    /*
     * Controls
     */

    var mute = function mute() {
        group.mute();
        return api;
    };

    var unMute = function unMute() {
        group.unMute();
        return api;
    };

    var fade = function fade(volume, duration) {
        group.fade(volume, duration);
        return api;
    };

    var pauseAll = function pauseAll() {
        group.pause();
        return api;
    };

    var resumeAll = function resumeAll() {
        group.resume();
        return api;
    };

    var stopAll = function stopAll() {
        group.stop();
        return api;
    };

    var play = function play(id, delay, offset) {
        group.find(id, function (sound) {
            sound.play(delay, offset);
        });
        return api;
    };

    var pause = function pause(id) {
        group.find(id, function (sound) {
            sound.pause();
        });
        return api;
    };

    var stop = function stop(id) {
        group.find(id, function (sound) {
            sound.stop();
        });
        return api;
    };

    /*
     * Mobile touch lock
     */

    var isTouchLocked = browser.handleTouchLock(context, function () {
        isTouchLocked = false;
        group.sounds.forEach(function (sound) {
            sound.isTouchLocked = false;
        });
    });

    /*
     * Page visibility events
     */

    (function () {
        var pageHiddenPaused = [];

        // pause currently playing sounds and store refs
        function onHidden() {
            group.sounds.forEach(function (sound) {
                if (sound.playing) {
                    sound.pause();
                    pageHiddenPaused.push(sound);
                }
            });
        }

        // play sounds that got paused when page was hidden
        function onShown() {
            while (pageHiddenPaused.length) {
                pageHiddenPaused.pop().play();
            }
        }

        browser.handlePageVisibility(onHidden, onShown);
    })();

    /*
     * Log version & device support info
     */

    var log = function log() {
        var title = 'sono ' + VERSION,
            info = 'Supported:' + api.isSupported + ' WebAudioAPI:' + api.hasWebAudio + ' TouchLocked:' + isTouchLocked + ' Extensions:' + file.extensions;

        if (navigator.userAgent.indexOf('Chrome') > -1) {
            var args = ['%c ♫ ' + title + ' ♫ %c ' + info + ' ', 'color: #FFFFFF; background: #379F7A', 'color: #1F1C0D; background: #E0FBAC'];
            console.log.apply(console, args);
        } else if (window.console && window.console.log.call) {
            console.log.call(console, title + ' ' + info);
        }
    };

    api = {
        createSound: createSound,
        destroySound: destroySound,
        destroyAll: destroyAll,
        getSound: getSound,
        createGroup: createGroup,
        load: load,
        mute: mute,
        unMute: unMute,
        fade: fade,
        pauseAll: pauseAll,
        resumeAll: resumeAll,
        stopAll: stopAll,
        play: play,
        pause: pause,
        stop: stop,
        log: log,

        canPlay: file.canPlay,
        context: context,
        effect: group.effect,
        extensions: file.extensions,
        hasWebAudio: !!context,
        isSupported: file.extensions.length > 0,
        gain: group.gain,
        utils: utils,
        VERSION: VERSION
    };

    /*
     * Getters & Setters
     */

    Object.defineProperties(api, {
        isTouchLocked: {
            get: function get() {
                return isTouchLocked;
            }
        },
        sounds: {
            get: function get() {
                return group.sounds.slice(0);
            }
        },
        volume: {
            get: function get() {
                return group.volume;
            },
            set: function set(value) {
                group.volume = value;
            }
        }
    });

    return Object.freeze(api);
}

module.exports = new Sono();

},{"./lib/group.js":32,"./lib/sound.js":33,"./lib/utils/browser.js":39,"./lib/utils/file.js":41,"./lib/utils/loader.js":42,"./lib/utils/sound-group.js":44,"./lib/utils/utils.js":45}]},{},[19]);

//# sourceMappingURL=bundle.js.map
