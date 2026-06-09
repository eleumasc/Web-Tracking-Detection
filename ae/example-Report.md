
# Web Tracking Detection: Analysis Report

## General Stats
- Size of site list: 1
- Number of analyzed sites: 1

## Dataset Details

- Number of tracking requests (found by some technique): 1
- Number of tracking requests found by taint tracking: 1
- Number of tracking requests found ONLY by taint tracking: 0
- Number of tracking requests found by syntactic matching: 1
- Number of tracking requests found ONLY by syntactic matching: 0
- Number of tracking requests found by both techniques: 1

**Validation of tracking request found ONLY by taint tracking**

- Confirmed (TP): 0 (NaN%)
- Unknown: 0 (NaN%)


**Validation of tracking requests found by syntactic matching**

- No matching requests: 0
- Confirmed (TP): 1 (100%)
- Refuted (FP): 0 (0%)
- Unknown: 0 (0%)


**Validation of tracking requests found ONLY by syntactic matching**

- No matching requests: 0
- Confirmed (TP): 0 (NaN%)
- Refuted (FP): 0 (NaN%)
- Unknown: 0 (NaN%)


**Validation of tracking requests found by both techiques**

- No matching requests: 0
- Confirmed (TP): 1 (100%)
- Refuted (FP): 0 (0%)
- Unknown: 0 (0%)



## Table 4

|  Measure  |  S  |  S-NR  |  S-C  |  T  |  S-C union T  |
| :-------- | :-: | :----: | :---: | :-: | :-----------: |
| Total num of tracking req | 1 | 1 | 1 | 1 | 1 |
| ... In Disconnect | 0 | 0 | 0 | 0 | 0 |
| Average num of tracking req | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| ... In Disconnect | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Total num of trackers | 1 | 1 | 1 | 1 | 1 |
| ... In Disconnect | 0 | 0 | 0 | 0 | 0 |
| Average num of trackers | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| ... In Disconnect | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| N of sites with a tracker | 1 | 1 | 1 | 1 | 1 |
| ... In Disconnect | 0 | 0 | 0 | 0 | 0 |


## Table 5

|  Measure  |  S-C  |  --Disconnect  |  T  |  --Disconnect  |
| :-------- | :---: | :------------: | :-: | :------------: |
| Total num of tracking req | 1 | 1 | 1 | 1 |
| Avg num of tracking req | 1.00 | 1.00 | 1.00 | 1.00 |
| Total num of trackers | 1 | 1 | 1 | 1 |
| Avg num of trackers| 1.00 | 1.00 | 1.00 | 1.00 |
| N of sites with a tracker | 1 | 1 | 1 | 1 |


## Table 6

|  S  |  #  |  S-NR  |  #  |  S-C  |  #  |  T  |  #  |
| :-- | :-: | :----- | :-: | :---- | :-: | :-- | :-: |
| trk.internal | 1 | trk.internal | 1 | trk.internal | 1 | trk.internal | 1 |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |


## Table 7

|  S-C --Disconnect  |  #  |  T --Disconnect  |  #  |
| :----------------- | :-: | :--------------- | :-: |
| trk.internal | 1 | trk.internal | 1 |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

