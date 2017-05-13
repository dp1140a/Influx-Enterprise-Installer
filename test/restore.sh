#!/bin/bash

for i in `seq -f '%2g' 1 $1`;
do
 vagrant snapshot restore node$i node${i}_initial
done
