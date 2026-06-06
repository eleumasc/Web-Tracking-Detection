from flask import Flask, request, send_file, jsonify

app = Flask(__name__)

@app.route("/")
def index():
  host = request.host.split(":")[0]

  if host == "www.internal" or host == "localhost":
    return send_file("index.html")

  return "unknown host", 404


@app.route("/track")
def track():
  print("tracking:", request.args.get("uid"))
  return jsonify(ok=True)

if __name__ == "__main__":
  app.run(host="0.0.0.0", port=80, debug=False, use_reloader=False)
