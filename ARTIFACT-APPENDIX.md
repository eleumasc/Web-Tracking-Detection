# Artifact Appendix

Paper title: **From Syntactic Matching to Taint Tracking and Back: A Comparative Study of Web Tracking Detection Techniques**

Requested Badge(s):

- [ X ] **Available**
- [ X ] **Functional**
- [ X ] **Reproduced**

## Description

The artifact supports the following paper:

*Stefano Calzavara, Samuele Casarin, Marco Squarcina, and Matteo Maffei. 2026. "From Syntactic Matching to Taint Tracking and Back: A Comparative Study of Web Tracking Detection Techniques."*

This artifact contains the full analysis pipeline used to reproduce the empirical findings of the paper, including implementations of syntactic matching and taint tracking, as well as scripts for running large-scale evaluations over web measurement data.

The repository provides all code required to process the dataset and generate the tables and results reported in the paper. The corresponding dataset is publicly available on Zenodo and is automatically downloaded during execution of the provided artifact scripts.

Overall, the artifact enables end-to-end reproduction of the comparative study on web tracking detection techniques and supports verification of all reported quantitative results.

#### Featured Links

* Code: https://github.com/eleumasc/Web-Tracking-Detection
* Dataset: https://zenodo.org/records/20593708

### Security/Privacy Issues and Ethical Concerns

This artifact does not pose any intended security or privacy risks to users or their machines.

## Basic Requirements

### Hardware Requirements

#### Minimum Hardware Requirements

Can run on a laptop (No special hardware requirements).

To reproduce all experiments comfortably, we recommend:

* RAM: 8 GB
* Storage: 100 GB of available disk space

The artifact is CPU-bound and benefits from many cores, but no GPU or other accelerator is required.

#### Hardware Used for the Reported Experiments

The experiments reported in the paper were executed on the following system:

* CPU: AMD EPYC 7713 (20 cores @ 2.00 GHz)
* RAM: 40 GB
* Storage: 500 GB

#### Additional Validation Hardware

The artifact was also tested during artifact preparation on the following system:

* CPU: 13th Gen Intel Core i7-13700H (20 cores @ 2.40 GHz)
* RAM: 32 GB
* Storage: 100 GB

All experiments completed successfully on this machine and produced identical results.

### Software Requirements

#### Operating System

The artifact was developed and tested on **Ubuntu 24.04.1 LTS**. The artifact is packaged as a Docker container and is therefore expected to run on other operating systems that support Docker. However, it has only been tested on Linux-based systems.

#### Operating System Packages

No additional host OS packages are required beyond a working Docker installation. All software dependencies needed by the artifact are included in the provided container image.

#### Artifact Packaging

The artifact is distributed as a **Docker** container and was tested with **Docker 29.5.2 (build 79eb04c)**.

#### Programming Languages

The artifact is primarily executed using **Node.js 22.19.0**, which is pre-installed in the Docker image.

#### Software Dependencies

All application dependencies are installed automatically within the Docker container. In particular, the complete list of npm packages and their versions is specified in `package.json` and `package-lock.json`.

#### Datasets

The artifact requires the dataset collected during our web measurement study and the Disconnect tracker list. These resources are downloaded automatically by the provided scripts and do not require manual installation:

* Measurement dataset: Zenodo archive containing the crawl data and analysis artifacts (https://zenodo.org/records/20593708/files/1771085049936-Analyze.7z).
* Disconnect tracker list: `services.json` from the Disconnect tracking-protection repository (https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/ea1d534182be4977861682de4408c8f250865b7c/services.json).

The downloaded dataset contains both the raw measurement data (HTTP requests and taint reports) and the pre-computed intermediate results required to reproduce the experiments described in the paper.

### Estimated Time and Storage Consumption

Executing the full artifact, including all experiments, requires approximately one compute-hour on a machine with the recommended specifications and 15-20 CPU cores. Human involvement is limited to setting up the environment and launching the experiments, requiring approximately 15 minutes in total.

The artifact consumes approximately 50 GB of disk space, primarily for storing the crawl dataset and associated analysis artifacts.

## Environment

### Accessibility

The artifact is available on GitHub: https://github.com/eleumasc/Web-Tracking-Detection/tree/main

### Set up the environment

1. Clone this repository: `git clone https://github.com/eleumasc/Web-Tracking-Detection && cd Web-Tracking-Detection`
2. Copy `.env.example` to `.env`, then possibly edit `.env` by setting a preferred value for `DOCKER_IMAGE` (default is `wtd-analysis`) and `DOCKER_NET` (default is `wtd-net`).
3. Build: `./build.sh`

### Testing the Environment

To verify that the artifact environment has been set up correctly, execute the following command from the project root:

```bash
bash ae/run_functional.sh
```

This command runs a small end-to-end analysis on a synthetic website that simulates stateful tracking. The test exercises all major components of the artifact, including data collection and processing.

The environment should be considered correctly configured if the script completes without fatal errors and generates a report identical to `ae/example-Report.md`. This report serves as a reference output and demonstrates the expected structure of the results produced by the full pipeline.

## Artifact Evaluation

### Main Results and Claims

All main results described below are reproducible by executing our **Experiment 1**.

#### Main Result 1: False Positives of Syntactic Matching

Our paper claims that tracking requests detected solely through syntactic matching are more prone to false positives. We show that the estimated false positive rate increases from 16% - 19% overall to 27% - 30% when considering only requests not unveiled by taint tracking. These results are discussed in Section 4.3.1 of the paper.

#### Main Result 2: False Negatives of Taint Tracking

Our paper claims that taint tracking may miss approximately one third of tracking requests. We show that the estimated number of true positives among requests detected exclusively through syntactic matching is between 11,249 and 11,652, corresponding to 28% - 29% of the entire dataset. These results are reported in Section 4.4.2 of the paper.

#### Main Result 3: Variants of Syntactic Matching

Our paper claims that the three syntactic matching variants (i.e., Syntactic, SyntacticNR, and SyntacticC) produce similar results for the most prevalent trackers, but exhibit relevant differences for less popular trackers. Table 6 shows similar top-ten trackers across all variants, while Table 4 shows that each refinement removes trackers that manual inspection identified predominantly as false positives. These results are discussed in Section 5.2 of the paper.

#### Main Result 4: Syntactic Matching vs. Taint Tracking

Our paper claims that taint tracking is more precise than syntactic matching. Table 4 shows that 82% of the 23,109 tracking requests identified by taint tracking are sent to domains included in Disconnect, compared with at most 78% for syntactic matching. Moreover, Table 6 shows that taint tracking detects requests to region1.google-analytics.com on 1,923 websites, compared with 511 websites for syntactic matching. These results are discussed in Section 5.3 of the paper.

#### Main Result 5: Combining Techniques

Our paper claims that combining SyntacticC and taint tracking yields the most comprehensive detection results. Table 4 shows that their union identifies 34,358 tracking requests, corresponding to a 49% increase over taint tracking and a 35% increase over SyntacticC, while also achieving the highest percentage of requests sent to domains included in Disconnect (83%). These results are discussed in Section 5.4 of the paper.

#### Main Result 6: Effectiveness of Filter Lists

Our paper claims that the Disconnect tracking list removes a comparable proportion of tracking requests identified by SyntacticC and taint tracking, while still missing relevant trackers. Table 5 shows reductions of -78% and -82%, respectively, and Table 7 highlights similarities between top trackers that are not covered by Disconnect. These results are discussed in Section 5.5 of the paper.

### Experiments

#### Experiment 1: 10k-Sites Web Measurement

* **Time:** 2 human-minutes + one compute-hour
* **Storage:** 50 GB

This experiment reproduces **Main Results 1-6**. It processes the dataset collected during our large-scale crawl, computes all metrics reported in the paper, and generates the tables used to support the paper's claims.

To execute the experiment, run the following command from the project root:

```bash
bash ae/run_reproduced.sh
```

The script automatically downloads the crawl dataset and the Disconnect tracker list, executes the complete analysis pipeline, and generates a Markdown report containing all reproduced results. The downloaded dataset includes both the raw crawl artifacts (HTTP requests and taint reports) and the pre-computed lists of requests detected by taint tracking and syntactic matching that were used for the validation process described in Section 4.2 of the paper.

Upon completion, the latest generated `data/*.md` report should be identical to the reference report available on Zenodo: https://zenodo.org/records/20593708/files/1780593007090-Report-1771542109548-Process.md. The report contains all results supporting the paper's main claims: the "Dataset Details" section supports **Main Results 1 and 2**, while the generated tables support **Main Results 3-6**. The reproduced values should match those reported in the paper exactly, as the experiment analyzes the same dataset used in the study.

The output of every pipeline step is also available on Zenodo and can be used to verify intermediate and final results independently.

## Limitations

The live data collection step is not fully reproducible because repeated crawls of the web can yield non-deterministic results due to changes in websites and tracking infrastructure. However, the artifact includes the complete anonymized dataset used in the paper, enabling deterministic reproduction of all quantitative analyses and tables. Only parts relying on manual inspection cannot be automated. Despite this, the artifact still supports evaluation, as it allows reproduction of all main reported results and verification of the full analysis pipeline.

## Notes on Reusability

The code provided in this repository can be reused to perform the same experiments on newly collected data. Furthermore, we argue that the implementation is sufficiently modular to facilitate extensions of the analysis. For example, Foxhound can be replaced with another browser, the syntactic matching algorithm can be modified, and alternative web tracking detection approaches, including techniques based on machine learning, can be integrated.
