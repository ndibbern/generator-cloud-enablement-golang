FROM golang:1.8.1-alpine

# Update packages and install dependency packages for services
RUN apk update && apk add --no-cache bash git
RUN apt-get update \
<% for (var index = 0; index < servicesPackages.length; index++) { -%>
 && apt-get install -y <%- servicesPackages[index] %> \
<% } -%>
 && apt-get dist-upgrade -y \
 && apt-get clean \
 && echo 'Finished installing dependencies'

# Set up src directory
ENV SRC_DIR = /go/src/app

# Change working directory
WORKDIR $SRC_DIR

# Copy app files
COPY . $SRC_DIR

# Install dependencies (Go dep)
RUN go get -u github.com/golang/dep/...
RUN go get -u github.com/derekparker/delve/cmd/dlv
RUN cd $SRC_DIR
RUN dep ensure

# # Build App
# RUN CGO_ENABLED=0 go build

ENV PORT <%= port %>
EXPOSE <%= port %>
# CMD ${SRC_DIR}testing-docker
# CMD ["go", "run", "server.go"]
