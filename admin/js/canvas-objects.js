/**
 * SAIL Canvas Objects — Factory functions for Fabric.js intervention elements
 * Each function creates a Fabric.js object representing an intervention element.
 */
var SailCanvasObjects = (function() {
  'use strict';

  // Font Awesome 6 Free unicode lookup (Solid weight = 900)
  var FA_UNICODE = {
    'fas fa-info-circle':          '\uf05a',
    'fas fa-shield-halved':        '\uf3ed',
    'fas fa-robot':                '\uf544',
    'fas fa-wand-magic-sparkles':  '\ue2ca',
    'fas fa-wand-magic':           '\uf0d0',
    'fas fa-exclamation-triangle': '\uf071',
    'fas fa-eye':                  '\uf06e',
    'fas fa-tag':                  '\uf02b',
    'fas fa-circle-check':         '\uf058',
    'fas fa-fingerprint':          '\uf577',
    'fas fa-microchip':            '\uf2db',
    'fas fa-brain':                '\uf5dc',
    'fas fa-certificate':          '\uf0a3',
    'fas fa-hand':                 '\uf256',
    'fas fa-circle-exclamation':   '\uf06a',
    'fas fa-question-circle':      '\uf059',
    'fas fa-scale-balanced':       '\uf24e',
    'fas fa-magnifying-glass':     '\uf002',
    'fas fa-bolt':                 '\uf0e7',
    'fas fa-users':                '\uf0c0',
    'fas fa-font':                 '\uf031',
    'fas fa-square':               '\uf0c8'
  };

  function getIconChar(faClass) {
    return FA_UNICODE[faClass] || '\uf05a'; // fallback to info-circle
  }

  /**
   * Create a badge Fabric group (rounded rect + icon + text)
   */
  function createBadge(canvas, props) {
    props = props || {};
    var text = props.text || 'AI-generated content';
    var bgColor = props.bgColor || '#1D9BF0';
    var textColor = props.textColor || '#ffffff';
    var fontSize = props.fontSize || 12;
    var radius = props.radius || 20;
    var opacity = props.opacity != null ? props.opacity : 1;
    var iconClass = props.icon || 'fas fa-info-circle';

    var iconChar = getIconChar(iconClass);

    var iconText = new fabric.Text(iconChar, {
      fontFamily: 'Font Awesome 6 Free',
      fontWeight: 900,
      fontSize: fontSize - 1,
      fill: textColor,
      originX: 'left',
      originY: 'center'
    });

    var labelText = new fabric.Text(' ' + text, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 600,
      fontSize: fontSize,
      fill: textColor,
      originX: 'left',
      originY: 'center'
    });

    // Calculate dimensions
    var padding = { x: 10, y: 4 };
    var totalWidth = iconText.width + labelText.width + padding.x * 2;
    var totalHeight = Math.max(iconText.height, labelText.height) + padding.y * 2;

    var bg = new fabric.Rect({
      width: totalWidth,
      height: totalHeight,
      rx: Math.min(radius, totalHeight / 2),
      ry: Math.min(radius, totalHeight / 2),
      fill: bgColor,
      originX: 'center',
      originY: 'center'
    });

    // Position icon and text centered
    iconText.set({ left: -totalWidth / 2 + padding.x, top: 0 });
    labelText.set({ left: -totalWidth / 2 + padding.x + iconText.width, top: 0 });

    var group = new fabric.Group([bg, iconText, labelText], {
      left: props.left || 20,
      top: props.top || 20,
      opacity: opacity,
      hasControls: true,
      hasBorders: true,
      lockRotation: true,
      cornerColor: '#6366f1',
      borderColor: '#6366f1',
      cornerSize: 8,
      transparentCorners: false
    });

    // Restore preserved scale from previous drag/resize
    if (props.scaleX) group.scaleX = props.scaleX;
    if (props.scaleY) group.scaleY = props.scaleY;

    group.set('interventionType', 'badge');
    group.set('sailProps', Object.assign({}, props));

    return group;
  }

  /**
   * Create an AI icon Fabric group (small pill with icon + label)
   */
  function createAiIcon(canvas, props) {
    props = props || {};
    var type = props.type || 'full';
    var label = props.label || (type === 'full' ? 'AI' : 'AI+');
    var bgColor = props.bgColor || 'rgba(0,0,0,0.55)';
    var textColor = props.textColor || '#ffffff';
    var iconClass = props.icon || 'fas fa-wand-magic-sparkles';

    var iconChar = getIconChar(iconClass);

    var iconText = new fabric.Text(iconChar, {
      fontFamily: 'Font Awesome 6 Free',
      fontWeight: 900,
      fontSize: 11,
      fill: textColor,
      originX: 'left',
      originY: 'center'
    });

    var labelText = new fabric.Text(' ' + label, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 600,
      fontSize: 11,
      fill: textColor,
      originX: 'left',
      originY: 'center'
    });

    var padding = { x: 8, y: 3 };
    var totalWidth = iconText.width + labelText.width + padding.x * 2;
    var totalHeight = Math.max(iconText.height, labelText.height) + padding.y * 2;

    var bg = new fabric.Rect({
      width: totalWidth,
      height: totalHeight,
      rx: 14,
      ry: 14,
      fill: bgColor,
      originX: 'center',
      originY: 'center'
    });

    iconText.set({ left: -totalWidth / 2 + padding.x, top: 0 });
    labelText.set({ left: -totalWidth / 2 + padding.x + iconText.width, top: 0 });

    var group = new fabric.Group([bg, iconText, labelText], {
      left: props.left || 300,
      top: props.top || 20,
      hasControls: true,
      hasBorders: true,
      lockRotation: true,
      cornerColor: '#6366f1',
      borderColor: '#6366f1',
      cornerSize: 8,
      transparentCorners: false
    });

    // Restore preserved scale from previous drag/resize
    if (props.scaleX) group.scaleX = props.scaleX;
    if (props.scaleY) group.scaleY = props.scaleY;

    group.set('interventionType', 'ai_icon');
    group.set('sailProps', Object.assign({}, props));

    return group;
  }

  /**
   * Create a community note Fabric group
   */
  function createCommunityNote(canvas, props) {
    props = props || {};
    var title = props.title || 'Readers added context';
    var body = props.body || 'Readers added context they thought people might want to know.';
    var bgColor = props.bgColor || '#FEF9EF';
    var borderColor = props.borderColor || '#F5DEB3';
    var noteWidth = props.width || 340;

    var padding = 14;

    // Title
    var titleText = new fabric.Text(title, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 700,
      fontSize: 13,
      fill: '#5C4B33',
      originX: 'left',
      originY: 'top',
      left: -noteWidth / 2 + padding + 24, // offset for icon
      top: -60 + padding
    });

    // Body
    var bodyText = new fabric.Textbox(body, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 13,
      fill: '#5C4B33',
      width: noteWidth - padding * 2,
      lineHeight: 1.5,
      originX: 'left',
      originY: 'top',
      left: -noteWidth / 2 + padding,
      top: -60 + padding + 24
    });

    var totalHeight = padding + 24 + bodyText.height + padding + 8;

    var bg = new fabric.Rect({
      width: noteWidth,
      height: totalHeight,
      rx: 12,
      ry: 12,
      fill: bgColor,
      stroke: borderColor,
      strokeWidth: 1,
      originX: 'center',
      originY: 'center'
    });

    // Reposition text relative to bg center
    titleText.set({ left: -noteWidth / 2 + padding + 24, top: -totalHeight / 2 + padding });
    bodyText.set({ left: -noteWidth / 2 + padding, top: -totalHeight / 2 + padding + 24 });

    var group = new fabric.Group([bg, titleText, bodyText], {
      left: props.left || 20,
      top: props.top || 350,
      hasControls: true,
      hasBorders: true,
      lockRotation: true,
      cornerColor: '#6366f1',
      borderColor: '#6366f1',
      cornerSize: 8,
      transparentCorners: false
    });

    // Restore preserved scale from previous drag/resize
    if (props.scaleX) group.scaleX = props.scaleX;
    if (props.scaleY) group.scaleY = props.scaleY;

    group.set('interventionType', 'community_notes');
    group.set('sailProps', Object.assign({}, props));

    return group;
  }

  /**
   * Create a custom text element
   */
  function createCustomText(canvas, props) {
    props = props || {};
    var textbox = new fabric.Textbox(props.text || 'Custom text', {
      left: props.left || 50,
      top: props.top || 100,
      width: props.width || 200,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: props.fontSize || 14,
      fill: props.fill || '#333333',
      fontWeight: props.fontWeight || 400,
      editable: true,
      hasControls: true,
      hasBorders: true,
      cornerColor: '#6366f1',
      borderColor: '#6366f1',
      cornerSize: 8,
      transparentCorners: false,
      editingBorderColor: '#6366f1'
    });

    textbox.set('interventionType', 'custom_text');
    textbox.set('customElement', true);

    return textbox;
  }

  /**
   * Create a custom shape (rectangle)
   */
  function createCustomShape(canvas, props) {
    props = props || {};
    var rect = new fabric.Rect({
      left: props.left || 50,
      top: props.top || 100,
      width: props.width || 120,
      height: props.height || 40,
      fill: props.fill || 'rgba(99, 102, 241, 0.2)',
      stroke: props.stroke || '#6366f1',
      strokeWidth: props.strokeWidth || 2,
      rx: props.rx || 8,
      ry: props.ry || 8,
      hasControls: true,
      hasBorders: true,
      cornerColor: '#6366f1',
      borderColor: '#6366f1',
      cornerSize: 8,
      transparentCorners: false
    });

    rect.set('interventionType', 'custom_shape');
    rect.set('customElement', true);

    return rect;
  }

  return {
    createBadge: createBadge,
    createAiIcon: createAiIcon,
    createCommunityNote: createCommunityNote,
    createCustomText: createCustomText,
    createCustomShape: createCustomShape,
    FA_UNICODE: FA_UNICODE,
    getIconChar: getIconChar
  };
})();
