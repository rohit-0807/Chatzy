import cohere
from flask import Flask, render_template, request, session, jsonify
import secrets
from dotenv import load_dotenv
import os
from datetime import datetime
import json

load_dotenv()

app = Flask(__name__, template_folder='../templates', static_folder='../static')
app.secret_key = secrets.token_hex(16)  # Set a secret key for CSRF protection

# Replace with your free Cohere API key (get one at https://dashboard.cohere.com/)
COHERE_API_KEY = os.getenv('API')

# Initialize session-based chat history
def get_chat_history():
    """Get chat history from session"""
    return session.get('chat_history', [])

def add_to_history(user_input, bot_response):
    """Add conversation to session history"""
    if 'chat_history' not in session:
        session['chat_history'] = []
    
    conversation = {
        # 'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'user_input': user_input,
        'bot_response': bot_response
    }
    
    session['chat_history'].append(conversation)
    
    # Keep only last 50 conversations to prevent session bloat
    if len(session['chat_history']) > 50:
        session['chat_history'] = session['chat_history'][-50:]
    
    session.permanent = True

@app.route('/', methods=['GET', 'POST'])
def home():
    output = None
    chat_history = get_chat_history()
    
    if request.method == 'POST':
        user_input = request.form['user_input']
        
        try:
            co = cohere.Client(COHERE_API_KEY)
            response = co.chat(
                # model='command-nightly',         # Use the latest free model
                model='command-a-03-2025',  
                message=user_input,
                max_tokens=1000,
                temperature=0.7
            )
            output = response.text
            
            # Add to server-side history
            add_to_history(user_input, output)
            
            # Update chat_history for template
            chat_history = get_chat_history()
            
        except Exception as e:
            output = f"Error: {str(e)}"
            add_to_history(user_input, output)
            chat_history = get_chat_history()
    
    return render_template('home.html', output=output, chat_history=chat_history)

@app.route('/api/history')
def api_history():
    """API endpoint to get chat history"""
    return jsonify(get_chat_history())

@app.route('/api/clear_history', methods=['POST'])
def api_clear_history():
    """API endpoint to clear chat history"""
    session['chat_history'] = []
    return jsonify({'status': 'success', 'message': 'History cleared'})

@app.route('/api/delete_conversation', methods=['POST'])
def api_delete_conversation():
    """API endpoint to delete a specific conversation"""
    try:
        data = request.get_json()
        index = data.get('index')
        
        chat_history = get_chat_history()
        if 0 <= index < len(chat_history):
            chat_history.pop(index)
            session['chat_history'] = chat_history
            return jsonify({'status': 'success', 'message': 'Conversation deleted'})
        else:
            return jsonify({'status': 'error', 'message': 'Invalid index'}), 400
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def api_chat():
    """API endpoint to process chat message asynchronously"""
    try:
        data = request.get_json()
        user_input = data.get('message', '').strip()
        if not user_input:
            return jsonify({'status': 'error', 'message': 'Empty message'}), 400

        co = cohere.Client(COHERE_API_KEY)
        response = co.chat(
            # model='command-nightly',
            model='command-a-03-2025',
            message=user_input,
            max_tokens=3000,
            temperature=0.7
        )
        bot_response = response.text

        # Persist to session history
        add_to_history(user_input, bot_response)

        return jsonify({'status': 'success', 'response': bot_response})
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        add_to_history(user_input if 'user_input' in locals() else '', error_msg)
        return jsonify({'status': 'error', 'response': error_msg}), 500

if __name__ == "__main__":
    # Bind to host 0.0.0.0 and the port provided by the environment (default 5000)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)