FROM debian:bookworm-slim

LABEL org.opencontainers.image.title="Hacker CLI Gym" \
      org.opencontainers.image.description="A disposable Linux command-line practice gym" \
      org.opencontainers.image.source="https://github.com/mikegropp/hacker-cli-gym" \
      org.opencontainers.image.licenses="MIT"

ENV DEBIAN_FRONTEND=noninteractive \
    HOME=/work \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TERM=xterm-256color

# Docker containers share the host kernel clock. Paused and restored training
# VMs commonly drift, so accept repository metadata up to one hour ahead while
# keeping APT's date and expiration security checks enabled.
RUN apt-get -o Acquire::Max-FutureTime=3600 update \
    && apt-get install --yes --no-install-recommends \
        bash \
        binutils \
        bsdextrautils \
        busybox \
        bzip2 \
        ca-certificates \
        coreutils \
        curl \
        diffutils \
        file \
        findutils \
        gawk \
        grep \
        gzip \
        hostname \
        iproute2 \
        iputils-ping \
        jq \
        less \
        man-db \
        ncal \
        netbase \
        openssh-client \
        openssh-server \
        procps \
        rsync \
        sed \
        systemd \
        systemd-journal-remote \
        tar \
        time \
        util-linux \
        wget \
        xxd \
        xz-utils \
        zip \
        unzip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /usr/share/doc/* /usr/share/info/* /usr/share/man/*

COPY container/gym /opt/hacker-cli-gym/gym
COPY curriculum/linux.json /opt/hacker-cli-gym/curriculum/linux.json

RUN chmod 0755 /opt/hacker-cli-gym/gym \
    && mkdir -p /work /var/lib/hacker-cli-gym

WORKDIR /work

ENTRYPOINT ["/opt/hacker-cli-gym/gym"]
CMD ["start"]
