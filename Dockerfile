FROM node:14-buster

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/snatchbot

CMD '/entrypoint.sh'

