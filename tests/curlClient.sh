ipaddress="localhost"
port=3000

speechFile='"../audio/2830-3980-0043.wav"'
model='"vosk-model-en-us-aspire-0.2"'

jsonData='{"speech":'$speechFile',"model":'$model'}'

#  -w "\n\n%{time_starttransfer}\n" \
#  --data '{"speech":`$speechFile`","model":"english"}' \
# https://stackoverflow.com/questions/7172784/how-do-i-post-json-data-with-curl

curl \
  --output /dev/null \
  --silent \
  --header "Content-Type: application/json" \
  --request POST \
  --data $jsonData \
  http://$ipaddress:$port/transcript
