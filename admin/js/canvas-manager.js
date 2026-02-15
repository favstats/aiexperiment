/**
 * SAIL Canvas Manager — Fabric.js canvas overlay for intervention designer
 * Manages the transparent canvas over the live feed iframe preview.
 */
var SailCanvasManager = (function() {
  'use strict';

  var canvas = null;
  var container = null;
  var iframe = null;
  var snapEnabled = false;
  var snapSize = 10;
  var iframeReady = false;

  // Track intervention objects by type
  var objects = {
    badge: null,
    ai_icon: null,
    community_notes: null
  };

  // Callbacks for external wiring
  var onObjectMoved = null;
  var onObjectSelected = null;

  /**
   * Initialize the Fabric.js canvas over the designer iframe
   */
  function init(containerId, canvasId) {
    container = document.getElementById(containerId);
    iframe = container ? container.querySelector('.cc-designer-iframe') : null;
    if (!container || !iframe) {
      console.warn('[SailCanvas] Container or iframe not found');
      return;
    }

    var canvasEl = document.getElementById(canvasId);
    if (!canvasEl) {
      console.warn('[SailCanvas] Canvas element not found');
      return;
    }

    // Set initial canvas size to match iframe
    var rect = iframe.getBoundingClientRect();
    canvasEl.width = rect.width;
    canvasEl.height = rect.height;

    canvas = new fabric.Canvas(canvasId, {
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
      perPixelTargetFind: true,
      targetFindTolerance: 5
    });

    // Keep canvas size synced with iframe via ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function() {
        resizeCanvas();
      });
      ro.observe(iframe);
    }

    // Canvas event listeners
    canvas.on('object:modified', function(e) {
      handleObjectModified(e.target);
    });

    canvas.on('object:moving', function(e) {
      if (snapEnabled) {
        var obj = e.target;
        obj.set({
          left: Math.round(obj.left / snapSize) * snapSize,
          top: Math.round(obj.top / snapSize) * snapSize
        });
      }
    });

    canvas.on('selection:created', function(e) {
      if (onObjectSelected && e.selected && e.selected.length === 1) {
        onObjectSelected(e.selected[0]);
      }
    });

    canvas.on('selection:updated', function(e) {
      if (onObjectSelected && e.selected && e.selected.length === 1) {
        onObjectSelected(e.selected[0]);
      }
    });

    // When canvas has no objects, add passthrough so iframe is clickable
    canvas.on('object:added', updatePassthrough);
    canvas.on('object:removed', updatePassthrough);
    updatePassthrough();

    // Listen for sail-ready from iframe
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'sail-ready') {
        iframeReady = true;
        hideLoading();
      }
      if (e.data && e.data.type === 'sail-pong') {
        iframeReady = true;
        hideLoading();
      }
    });

    // Delete key handler
    document.addEventListener('keydown', function(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && canvas) {
        var active = canvas.getActiveObject();
        if (active && !active.isEditing) {
          removeObject(active);
        }
      }
    });

    return canvas;
  }

  function updatePassthrough() {
    if (!canvas) return;
    var wrapper = canvas.wrapperEl;
    if (!wrapper) return;
    if (canvas.getObjects().length === 0) {
      wrapper.classList.add('canvas-passthrough');
    } else {
      wrapper.classList.remove('canvas-passthrough');
    }
  }

  function resizeCanvas() {
    if (!canvas || !iframe) return;
    var rect = iframe.getBoundingClientRect();
    canvas.setWidth(rect.width);
    canvas.setHeight(rect.height);
    canvas.renderAll();
  }

  /**
   * Load the feed iframe with designer mode
   */
  function loadIframe(platformPath, urlParams) {
    if (!iframe) return;

    showLoading();
    iframeReady = false;

    // Build URL with mode=designer
    var params = new URLSearchParams(urlParams || '');
    params.set('mode', 'designer');
    if (!params.has('source')) params.set('source', 'json');
    if (!params.has('total_posts')) params.set('total_posts', '5');

    var url = platformPath + '?' + params.toString();
    iframe.src = url;

    // Fallback: hide loading after timeout if sail-ready never fires
    setTimeout(function() {
      hideLoading();
    }, 5000);
  }

  function showLoading() {
    var loader = container ? container.querySelector('.cc-designer-loading') : null;
    if (loader) loader.classList.remove('hidden');
  }

  function hideLoading() {
    var loader = container ? container.querySelector('.cc-designer-loading') : null;
    if (loader) loader.classList.add('hidden');
  }

  /**
   * Send intervention config to the iframe via postMessage
   */
  function sendConfig(configObj) {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'sail-update', config: configObj }, '*');
  }

  /**
   * Handle object modification (drag/resize)
   */
  function handleObjectModified(obj) {
    if (!obj) return;
    var type = obj.get('interventionType');
    if (type && onObjectMoved) {
      var pos = getObjectPosition(obj);
      onObjectMoved(type, pos);
    }
  }

  /**
   * Get object position as percentage of canvas dimensions
   */
  function getObjectPosition(obj) {
    if (!canvas) return { xPct: 0, yPct: 0, left: 0, top: 0, scaleX: 1, scaleY: 1, widthPct: 0, heightPct: 0 };
    var effWidth = obj.width * (obj.scaleX || 1);
    var effHeight = obj.height * (obj.scaleY || 1);
    return {
      left: Math.round(obj.left),
      top: Math.round(obj.top),
      xPct: parseFloat((obj.left / canvas.width * 100).toFixed(1)),
      yPct: parseFloat((obj.top / canvas.height * 100).toFixed(1)),
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      widthPct: parseFloat((effWidth / canvas.width * 100).toFixed(1)),
      heightPct: parseFloat((effHeight / canvas.height * 100).toFixed(1))
    };
  }

  /**
   * Add or update a badge on the canvas
   */
  function setBadge(props) {
    if (!canvas) return;
    // Capture old position+scale before removing
    var oldLeft = null, oldTop = null, oldScaleX = null, oldScaleY = null;
    if (objects.badge) {
      oldLeft = objects.badge.left;
      oldTop = objects.badge.top;
      oldScaleX = objects.badge.scaleX;
      oldScaleY = objects.badge.scaleY;
      canvas.remove(objects.badge);
    }
    if (!props || !props.enabled) {
      objects.badge = null;
      canvas.renderAll();
      return;
    }
    // Preserve old position+scale if not explicitly provided in props
    if (oldLeft != null && props.left == null) props.left = oldLeft;
    if (oldTop != null && props.top == null) props.top = oldTop;
    if (oldScaleX != null && props.scaleX == null) props.scaleX = oldScaleX;
    if (oldScaleY != null && props.scaleY == null) props.scaleY = oldScaleY;
    objects.badge = SailCanvasObjects.createBadge(canvas, props);
    canvas.add(objects.badge);
    canvas.renderAll();
  }

  /**
   * Add or update an AI icon on the canvas
   */
  function setAiIcon(props) {
    if (!canvas) return;
    // Capture old position+scale before removing
    var oldLeft = null, oldTop = null, oldScaleX = null, oldScaleY = null;
    if (objects.ai_icon) {
      oldLeft = objects.ai_icon.left;
      oldTop = objects.ai_icon.top;
      oldScaleX = objects.ai_icon.scaleX;
      oldScaleY = objects.ai_icon.scaleY;
      canvas.remove(objects.ai_icon);
    }
    if (!props || !props.enabled) {
      objects.ai_icon = null;
      canvas.renderAll();
      return;
    }
    // Preserve old position+scale if not explicitly provided in props
    if (oldLeft != null && props.left == null) props.left = oldLeft;
    if (oldTop != null && props.top == null) props.top = oldTop;
    if (oldScaleX != null && props.scaleX == null) props.scaleX = oldScaleX;
    if (oldScaleY != null && props.scaleY == null) props.scaleY = oldScaleY;
    objects.ai_icon = SailCanvasObjects.createAiIcon(canvas, props);
    canvas.add(objects.ai_icon);
    canvas.renderAll();
  }

  /**
   * Add or update community notes on the canvas
   */
  function setCommunityNotes(props) {
    if (!canvas) return;
    // Capture old position+scale before removing
    var oldLeft = null, oldTop = null, oldScaleX = null, oldScaleY = null;
    if (objects.community_notes) {
      oldLeft = objects.community_notes.left;
      oldTop = objects.community_notes.top;
      oldScaleX = objects.community_notes.scaleX;
      oldScaleY = objects.community_notes.scaleY;
      canvas.remove(objects.community_notes);
    }
    if (!props || !props.enabled) {
      objects.community_notes = null;
      canvas.renderAll();
      return;
    }
    // Preserve old position+scale if not explicitly provided in props
    if (oldLeft != null && props.left == null) props.left = oldLeft;
    if (oldTop != null && props.top == null) props.top = oldTop;
    if (oldScaleX != null && props.scaleX == null) props.scaleX = oldScaleX;
    if (oldScaleY != null && props.scaleY == null) props.scaleY = oldScaleY;
    objects.community_notes = SailCanvasObjects.createCommunityNote(canvas, props);
    canvas.add(objects.community_notes);
    canvas.renderAll();
  }

  /**
   * Add a custom text element
   */
  function addCustomText() {
    if (!canvas) return;
    var textObj = SailCanvasObjects.createCustomText(canvas, {
      left: 30 + Math.random() * 100,
      top: 30 + Math.random() * 100
    });
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.renderAll();
  }

  /**
   * Add a custom shape
   */
  function addCustomShape() {
    if (!canvas) return;
    var shapeObj = SailCanvasObjects.createCustomShape(canvas, {
      left: 30 + Math.random() * 100,
      top: 30 + Math.random() * 100
    });
    canvas.add(shapeObj);
    canvas.setActiveObject(shapeObj);
    canvas.renderAll();
  }

  /**
   * Remove the selected object
   */
  function removeSelected() {
    if (!canvas) return;
    var active = canvas.getActiveObject();
    if (active) {
      removeObject(active);
    }
  }

  function removeObject(obj) {
    if (!obj || !canvas) return;
    var type = obj.get('interventionType');
    if (type && objects[type]) {
      objects[type] = null;
    }
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
  }

  /**
   * Toggle snap-to-grid
   */
  function toggleSnap() {
    snapEnabled = !snapEnabled;
    return snapEnabled;
  }

  /**
   * Export canvas as PNG (canvas layer only)
   */
  function exportPNG() {
    if (!canvas) return;
    // Deselect all before export
    canvas.discardActiveObject();
    canvas.renderAll();

    var dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: 2 // Higher resolution
    });

    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'sail-intervention-design-' + new Date().toISOString().slice(0, 10) + '.png';
    a.click();
  }

  /**
   * Clear all canvas objects
   */
  function clearAll() {
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = 'transparent';
    objects.badge = null;
    objects.ai_icon = null;
    objects.community_notes = null;
    canvas.renderAll();
  }

  /**
   * Get all canvas positions for preset save
   */
  function getPositions() {
    var positions = {};
    Object.keys(objects).forEach(function(key) {
      if (objects[key]) {
        positions[key] = getObjectPosition(objects[key]);
      }
    });

    // Also capture custom elements
    var customElements = [];
    if (canvas) {
      canvas.getObjects().forEach(function(obj) {
        if (obj.get('customElement')) {
          customElements.push({
            type: obj.get('interventionType'),
            left: obj.left,
            top: obj.top,
            width: obj.width,
            height: obj.height,
            text: obj.text || '',
            fill: obj.fill,
            stroke: obj.stroke
          });
        }
      });
    }
    positions.custom = customElements;

    return positions;
  }

  /**
   * Restore canvas positions from preset
   */
  function setPositions(positions) {
    if (!positions) return;
    Object.keys(objects).forEach(function(key) {
      if (objects[key] && positions[key]) {
        var updates = {
          left: positions[key].left || 0,
          top: positions[key].top || 0
        };
        if (positions[key].scaleX) updates.scaleX = positions[key].scaleX;
        if (positions[key].scaleY) updates.scaleY = positions[key].scaleY;
        objects[key].set(updates);
      }
    });
    if (canvas) canvas.renderAll();
  }

  // Public API
  return {
    init: init,
    loadIframe: loadIframe,
    sendConfig: sendConfig,
    setBadge: setBadge,
    setAiIcon: setAiIcon,
    setCommunityNotes: setCommunityNotes,
    addCustomText: addCustomText,
    addCustomShape: addCustomShape,
    removeSelected: removeSelected,
    toggleSnap: toggleSnap,
    exportPNG: exportPNG,
    clearAll: clearAll,
    getPositions: getPositions,
    setPositions: setPositions,
    get canvas() { return canvas; },
    get iframeReady() { return iframeReady; },
    set onObjectMoved(fn) { onObjectMoved = fn; },
    set onObjectSelected(fn) { onObjectSelected = fn; }
  };
})();
