FROM golang:1.10.3-alpine

# Update packages and install dependency packages for services
RUN apk update && apk add --no-cache bash git tree

# Change working directory
WORKDIR $GOPATH/src/<%= applicationName %>/
COPY . ./

# Install dependencies
RUN go get -u github.com/golang/dep/...
RUN go get -u github.com/derekparker/delve/cmd/dlv/...
RUN dep ensure

# Bundle app source
COPY run-dev $GOPATH/bin
RUN chmod 777 $GOPATH/bin/run-dev
RUN chmod 777 $GOPATH/src/<%= applicationName %>/

ENV PORT <%= port %>
EXPOSE <%= port %>

CMD ["go", "run", "server.go"]
