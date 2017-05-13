#!/bin/bash

for i in `seq -f '%2g' 1 $1`;
do
 ssh-keygen -R 192.168.70.10$i
 vagrant up node$i
 vagrant snapshot save node$i initial_node$i
done
