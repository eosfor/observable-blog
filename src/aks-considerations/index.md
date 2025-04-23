---
title:  'Considerations when running private AKS cluster'
date:  2018-08-04 05:03:31 +03:00
section: Azure
---

For the last two weeks I've been playing with [Azure Kubernetes Service](https://docs.microsoft.com/en-us/azure/aks/) (AKS) and with it's public counterpart - [acs-engine](https://github.com/Azure/acs-engine). Here is a bit about the experience I got with it, having in mind I've never worked with these tools before. Here I'm trying to look at this from the Infrastructure perspective, but not from the developers' perspective.

## Containers, Cloud and private environments

### Few things to keep in mind for AKS

Well first of all, lets see what we've got. There are a lot of documentation on the Internet, I'm not going to repeat it here. I just want to highlight a few key points to keep in mind when building your clusters using either one of these two toolsets.

The Kubernetes, is an orchestrator software. It orchestrates containers across multiple nodes. So we may have master nodes and worker nodes. Master nodes perform management operations on the cluster and run major part of a control plane. Worker nodes are supposed to run workloads, meaning containers, and they are managed by specific software agents, which are in turn also a part of a control plane. On the other hand, Kubernetes does not run containers by itself. It just manages underlying container framework, like [Docker](https://www.docker.com). In terms of AKS as a managed offering, Microsoft runs and manages master nodes for you, and provides a public endpoint, where you can manage your cluster.

Another point to bear in mind is the following:

>Kubernetes imposes the following fundamental requirements on any networking implementation (barring any intentional network segmentation policies):
>
>- all containers can communicate with all other containers without NAT
>- all nodes can communicate with all containers (and vice-versa) without NAT
>- the IP that a container sees itself as is the same IP that others see it as

And from [networking perspective](https://kubernetes.io/docs/concepts/cluster-administration/networking/) we got another term to pay attention to - [CNI](https://www.youtube.com/watch?v=Vn6KYkNevBQ). In basic terms CNI is a piece of software, that allows your containers to communicate. In Azure we may use two types of CNIs - kubenet and [Azure CNI](https://github.com/Azure/azure-container-networking/blob/master/docs/cni.md). Kubenet is a basic component, which is native to Kubernetes and provided by it. Azure CNI, is a piece of software provided by Microsoft and supported in Azure. When using AKS, keep in mind that by default it uses kubenet, as a default networking plugin. You need to go through the documentation [here](https://docs.microsoft.com/en-us/azure/templates/microsoft.containerservice/managedclusters) and configure ```networkProfile``` section in order to set all parameters correctly, something like this

```json
"networkProfile": {
    "networkPlugin": "azure",
    "serviceCidr":"172.66.0.0/16",
    "DNSServiceIP":"172.66.0.10",
    "dockerBridgeCidr":"172.22.0.1/16"
}
```

Another thing to mention is that there was a requirement to put everything into a private VNET, accessible only from corporate environment. Typically corporate environments in Azure Hybrid Cloud are based on hub-and-spoke design, as follows:

![hub and spoke](https://docs.microsoft.com/en-us/azure/networking/media/networking-virtual-datacenter/vdc-high-level.png)

In most cases as part of this design, especially at the very beginning, you may have something called ["Forced tunneling"](https://docs.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-forced-tunneling-rm), which is basically a default route coming from On-Prem to forward all traffic back, for inspection. Sometime is causes issues. So, in order to be able to provision AKS, you need to make sure that the following list of domains is freely accessible from the VNET, you want to put your AKS to:

- *.azmk8s.io
- *.azureedge.net
- *.auth.docker.io
- *.quay.io
- *.blob.core.windows.net
- *.azure-automation.net
- *.opinsights.azure.com
- *.management.azure.com
- *.login.microsoftonline.com

These domains/apexes are used during provisioning process and "post-provisioning scripts", so if they are not available, your cluster wont come up.

In addition to this I've found unusual dependency in the provisioning procedure - ```8.8.8.8:53``` or ```8.8.4.4:53```. These "endpoints" needs to be accessible too.

Next thing to think about is this. You run only worker VMs, masters are running somewhere inside Microsoft. As part of it you get a publicly available endpoint, you can find the name of this endpoint on the portal. When you run ```az aks get-credentials --resource-group <your RG here> --name <your cluster name here>``` it creates the ```.kube``` folder and ```config``` file, where it stores all you need to connect to a cluster. So you can manage your cluster right over the Internet. This information may be crucial when making decisions about the technology to go with.

Another problem you may face are various internal dependencies. Such as DNS servers, internal authentication mechanisms, internal PKI, repositories and so on. If you need them, you need to think about adding proper configuration to the nodes in advance.

After provisioning you get a cluster object and an additional Resource Group, named something like ```MC_<cluster Resource Group Name>_<RG Location>``` with you worker VMs. In case you chose using azure-cni, each VM will have multiple IP addresses assigned. The number of IP addresses is configurable, and the idea is that each of your PODs will receive one of these IPs, which, in turn, fully accessible inside of VNET, and thus, fully routable inside of an organization. Typically you don't want to connect to these VMs directly, because they are, kind of, not persistent, so to speak. Each time you scale or update cluster to a newer version those VMs will be recreated and any custom configuration you put on those will be destroyed. So if you need some custom configuration from DNS side, for instance to set your internal DNS server as a default - use VNET level configuration.

Provisioning itself is very simple. You create a template based on the [ARM spec here](https://docs.microsoft.com/en-us/azure/templates/microsoft.containerservice/managedclusters) and run the deployment into a resource group.

Simple example looks like this:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "clusterName": {
      "type": "string"
    },
    "kubernetesVersion": {
      "type": "string",
      "defaultValue": "1.10.6",
      "allowedValues": [
        "1.10.6",
        "1.10.5",
        "1.10.3"
      ],
    },
    "vnetSubnetID": {
      "type": "string"
    },
    "dnsPrefix": {
      "type": "string"
    },
    "workerCount": {
      "type": "int"
    },
    "servicePrincipalClientId": {
      "type": "string",
      "metadata": {
        "description": "generate with the command line: "
      }
    },
    "servicePrincipalSecret": {
      "type": "securestring"
    },
    "vmSize": {
      "type": "string"
    }
  },
  "variables": {},
  "resources": [
    {
      "name": "[parameters('clusterName')]",
      "type": "Microsoft.ContainerService/managedClusters",
      "apiVersion": "2018-03-31",
      "location": "[resourceGroup().location]",
      "tags": {},
      "properties": {
        "kubernetesVersion": "[parameters('kubernetesVersion')]",
        "dnsPrefix": "[parameters('dnsPrefix')]",
        "agentPoolProfiles": [
          {
            "name": "[concat(parameters('clusterName'))]",
            "count": "[parameters('workerCount')]",
            "vmSize": "[parameters('vmSize')]",
            "vnetSubnetID": "[parameters('vnetSubnetID')]",
            "maxPods": 15
          }
        ],
        "linuxProfile": {
          "adminUsername": "azureuser",
          "ssh": {
            "publicKeys": [
              {
                "keyData": "ssh-rsa <key goes here>"
              }
            ]
          }
        },
        "networkProfile": {
          "networkPlugin": "azure",
          "serviceCidr":"172.66.0.0/16",
          "DNSServiceIP":"172.66.0.10",
          "dockerBridgeCidr":"172.33.0.1/16"
        },
        "servicePrincipalProfile": {
          "clientId": "[parameters('servicePrincipalClientId')]",
          "secret": "[parameters('servicePrincipalSecret')]"
        },
        "enableRBAC": false
      }
    }
  ],
  "outputs": {}
}
```

There are couple of things to pay attention to:

- **maxPods** option - sets the number of IPs per node, and through this number of PODs per node. Your need to have enough free IPs in your VNET for that
- **networkPlugin** options - sets the network plugin you want to use, "azure" means azure-cni
- **serviceCidr** option – sets a CIDR notation IP range from which to assign service cluster IPs. It must not overlap with any Subnet IP ranges
- **DNSServiceIP** option – sets An IP address assigned to the Kubernetes DNS service. It must be within the Kubernetes service address range specified in serviceCidr
- **dockerBridgeCidr** option – sets a CIDR notation IP range assigned to the Docker bridge network. It must not overlap with any Subnet IP ranges or the Kubernetes service address range
- **keyData** option – sets an ssh key to use to access VMs of a cluster. Using this you'll be able to login to your worker VMs

### Azure Kubernetes Service vs acs-engine

As far as I got, Azure Kubernetes Service and acs-engine are similar, but different. Well, from the Azure perspective both provision Kubernetes cluster for you. However, the main difference we've got with acs-engine is that it creates full cluster for you, including master nodes and worker nodes. It also requires access to the same set of endpoints and domains, as it uses, I guess, the same or similar set of scripts, to perform a deployment. One of the biggest benefits of acs-engine is that it is able to use your custom VNETs, and even your own custom images! However, they should be "compatible" with dpkg, as it is used in the scripts. Be default they support Ubuntu and RHEL. In general what acs-engine does is it takes a [json template of it's own format](https://github.com/Azure/acs-engine/blob/master/docs/clusterdefinition.md) as an input, and generates an ARM template, which then can be provisioned into a resource group. At the end of the day you get your own cluster in a form of a number of VMs, and you will need to manage this cluster yourself.

Example template may look like this:

```json
{
    "apiVersion": "vlabs",
    "properties": {
        "orchestratorProfile": {
            "orchestratorType": "Kubernetes",
            "kubernetesConfig": {
                "privateCluster": {
                    "enabled": true
                },
                "kubeletConfig": {
                    "--eviction-hard": "memory.available<250Mi,nodefs.available<20%,nodefs.inodesFree<10%",
                    "--max-pods": "10"
                }
            }
        },
        "masterProfile": {
            "count": 1,
            "dnsPrefix": "clusterdns",
            "vmSize": "Standard_D2s_v3",
            "vnetSubnetId": "/subscriptions/<your subscription ID>/resourceGroups/<network RG>/providers/Microsoft.Network/virtualNetworks/<network name>/subnets/<subnet name>",
            "firstConsecutiveStaticIP": "<ip address of a first master>",
            "vnetCidr": "10.10.5.0/24"
        },
        "agentPoolProfiles": [
            {
                "name": "devworker",
                "count": 3,
                "vmSize": "Standard_D2s_v3",
                "StorageProfile":"ManagedDisks",
                "diskSizesGB": [
                    256
                ],
                "vnetSubnetId": "/subscriptions/<your subscription ID>/resourceGroups/<network RG>/providers/Microsoft.Network/virtualNetworks/<network name>/subnets/<subnet name>",
                "availabilityProfile": "AvailabilitySet",
                "acceleratedNetworkingEnabled":false
            }
        ],
        "linuxProfile": {
            "adminUsername": "<admin name goes here>",
            "ssh": {
                "publicKeys": [
                    {
                        "keyData": "ssh-rsa <your key goes here>"
                    }
                ]
            }
        },
        "servicePrincipalProfile": {
            "clientId": "<your SP id goes here>",
            "secret": "<your secret goes here>"
        }
    }
}
```

As you can see it is similar to what AKS wants us to prepare so I conclude they are based on a similar codebase.
