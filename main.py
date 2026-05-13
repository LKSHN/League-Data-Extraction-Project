import json
import threading
import webbrowser
import pandas as pd
from flask import Flask, jsonify, send_from_directory

# Load champion ID -> name mapping
with open('champion_info.json') as f:
    champ_data = json.load(f)
champ_id_to_name = {int(k): v['name'] for k, v in champ_data['data'].items()}

# Load and reshape data
df = pd.read_csv('games.csv')

records = []
for _, row in df.iterrows():
    winner = row['winner']
    for team in (1, 2):
        for slot in range(1, 6):
            champ_id = row.get(f't{team}_champ{slot}id')
            if pd.isna(champ_id) or champ_id == 0:
                continue
            records.append({
                'champion_id': int(champ_id),
                'result': int(winner == team),
            })

df_champs = pd.DataFrame(records)
df_champs['champion'] = (
    df_champs['champion_id']
    .map(champ_id_to_name)
    .fillna(df_champs['champion_id'].astype(str))
)

champion_stats = df_champs.groupby('champion').agg(
    wins=('result', 'sum'),
    total_games=('result', 'count')
).reset_index()
champion_stats['win_rate'] = (
    champion_stats['wins'] / champion_stats['total_games'] * 100
).round(2)
champion_stats['loss_rate'] = (100 - champion_stats['win_rate']).round(2)
champion_stats = champion_stats[champion_stats['total_games'] >= 10]

data = champion_stats.sort_values('win_rate', ascending=False).to_dict(orient='records')

# Flask app
app = Flask(__name__, static_folder='.')

@app.route('/')
def index():
    return send_from_directory('.', 'app.html')

@app.route('/api/data')
def api_data():
    return jsonify(data)

PORT = 5000

def open_browser():
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == '__main__':
    print(f'Starting server at http://localhost:{PORT}')
    threading.Timer(0.8, open_browser).start()
    app.run(port=PORT, debug=False)
