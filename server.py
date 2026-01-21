#!/usr/bin/env python3
"""
Circl Development Server
Flask-based server with API endpoints for config management
"""

import os
import json
import glob
from pathlib import Path
from flask import Flask, send_from_directory, request, jsonify, abort
from flask_cors import CORS

# Configuration
PORT = 8000
BASE_DIR = Path(__file__).parent
CIRCL_DIR = BASE_DIR / 'circl'
DATA_DIR = CIRCL_DIR / 'data'
IMAGES_DIR = BASE_DIR / 'generated_images'

app = Flask(__name__, static_folder=str(BASE_DIR))
CORS(app)  # Enable CORS for all routes

# ============================================
# STATIC FILE SERVING
# ============================================

@app.route('/')
def index():
    """Serve the main index page"""
    return send_from_directory(str(BASE_DIR), 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from the base directory"""
    return send_from_directory(str(BASE_DIR), path)

# ============================================
# API ENDPOINTS
# ============================================

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get the feed configuration"""
    try:
        config_path = DATA_DIR / 'feed-config.json'
        if not config_path.exists():
            return jsonify({'error': 'Config file not found'}), 404
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        return jsonify(config)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/config', methods=['POST'])
def save_config():
    """Save the feed configuration"""
    try:
        config_path = DATA_DIR / 'feed-config.json'
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['feed_settings', 'personalization', 'locale']
        missing = [f for f in required_fields if f not in data]
        if missing:
            return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400
        
        # Pretty print JSON
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return jsonify({'success': True, 'message': 'Config saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stimuli', methods=['GET'])
def get_stimuli():
    """Get the stimuli data"""
    try:
        stimuli_path = DATA_DIR / 'stimuli.json'
        if not stimuli_path.exists():
            return jsonify({'posts': [], 'error': 'Stimuli file not found'}), 404
        
        with open(stimuli_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stimuli', methods=['POST'])
def save_stimuli():
    """Save the stimuli data"""
    try:
        stimuli_path = DATA_DIR / 'stimuli.json'
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        with open(stimuli_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return jsonify({'success': True, 'message': 'Stimuli saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/fillers', methods=['GET'])
def get_fillers():
    """Get the fillers data"""
    try:
        fillers_path = DATA_DIR / 'fillers.json'
        if not fillers_path.exists():
            return jsonify({'posts': [], 'error': 'Fillers file not found'}), 404
        
        with open(fillers_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/fillers', methods=['POST'])
def save_fillers():
    """Save the fillers data"""
    try:
        fillers_path = DATA_DIR / 'fillers.json'
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        with open(fillers_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return jsonify({'success': True, 'message': 'Fillers saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/images', methods=['GET'])
def list_images():
    """List all available generated images by condition"""
    try:
        if not IMAGES_DIR.exists():
            return jsonify({'conditions': []})
        
        conditions = []
        for condition_dir in sorted(IMAGES_DIR.iterdir()):
            if condition_dir.is_dir():
                images = sorted([
                    f.name for f in condition_dir.glob('*.jpg')
                ] + [
                    f.name for f in condition_dir.glob('*.png')
                ])
                conditions.append({
                    'condition_id': condition_dir.name,
                    'images': images,
                    'count': len(images)
                })
        
        return jsonify({
            'conditions': conditions,
            'total_conditions': len(conditions),
            'total_images': sum(c['count'] for c in conditions)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/images/<condition_id>', methods=['GET'])
def get_condition_images(condition_id):
    """Get images for a specific condition"""
    try:
        condition_dir = IMAGES_DIR / condition_id
        if not condition_dir.exists():
            return jsonify({'error': f'Condition {condition_id} not found'}), 404
        
        images = sorted([
            {
                'filename': f.name,
                'path': f'/generated_images/{condition_id}/{f.name}',
                'size': f.stat().st_size
            }
            for f in condition_dir.glob('*.jpg')
        ] + [
            {
                'filename': f.name,
                'path': f'/generated_images/{condition_id}/{f.name}',
                'size': f.stat().st_size
            }
            for f in condition_dir.glob('*.png')
        ])
        
        return jsonify({
            'condition_id': condition_id,
            'images': images,
            'count': len(images)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/status', methods=['GET'])
def api_status():
    """Get API status and available endpoints"""
    return jsonify({
        'status': 'ok',
        'version': '1.0',
        'endpoints': {
            'GET /api/config': 'Get feed configuration',
            'POST /api/config': 'Save feed configuration',
            'GET /api/stimuli': 'Get stimuli data',
            'POST /api/stimuli': 'Save stimuli data',
            'GET /api/fillers': 'Get fillers data',
            'POST /api/fillers': 'Save fillers data',
            'GET /api/images': 'List all condition images',
            'GET /api/images/<condition_id>': 'Get images for specific condition',
            'GET /api/status': 'This endpoint'
        }
    })

# ============================================
# MAIN
# ============================================

def main():
    print(f"\n{'='*60}")
    print(f"  Circl Development Server")
    print(f"{'='*60}")
    print(f"\n  Server running at: http://localhost:{PORT}")
    print(f"  Admin panel: http://localhost:{PORT}/circl/admin.html")
    print(f"  Feed: http://localhost:{PORT}/circl/feed.html?source=json")
    print(f"\n  API endpoints available at /api/")
    print(f"  Press Ctrl+C to stop the server\n")
    print(f"{'='*60}\n")
    
    app.run(host='0.0.0.0', port=PORT, debug=True)

if __name__ == '__main__':
    main()
