#!/usr/bin/env bash

yum update -y
# Install NTP
yum install ntp -y
service ntpd start
ntpdate -q time-b.nist.gov time-c.nist.gov

mkdir -p /root/.ssh
chmod 700 /root/.ssh
cat /vagrant/.ssh/id_rsa.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

mv /etc/hosts /etc/hosts.bkup
cp /vagrant/hosts /etc/hosts
chown root:root /etc/hosts
chmod 644 /etc/hosts

echo "ALL DONE"
